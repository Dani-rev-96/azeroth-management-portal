{

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:

    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            permittedInsecurePackages = [ ];
          };
        };

        package-json = pkgs.lib.trivial.importJSON ./package.json;

        defaultPkgs = with pkgs; [
          nodejs
          deno
          mariadb
          sops
          age
          sqlite-interactive
        ];

        name = package-json.name;
        version = "${package-json.version}-1";
        src = ./.;

        prod-package = pkgs.buildNpmPackage {
          name = name;
          version = version;
          src = src;
          buildInputs = [
            pkgs.node-gyp
            pkgs.nodejs
            pkgs.vips
          ];

          nativeBuildInputs = [
            pkgs.node-gyp
            pkgs.python3
            pkgs.pkg-config
            pkgs.vips
          ];

          npmDepsHash = "sha256-j7GWtwbiGG0IwNxbqeoUymWGQ/zPxrfAXyx+eJZSbDE=";
          # npmDepsHash = "";

          npmPackFlags = [ "--ignore-scripts" ];
          makeCacheWritable = true;
          npmFlags = [ "--legacy-peer-deps" ];

          buildPhase = ''
            # each phase has pre/postHooks. When you make your own phase be sure to still call the hooks
            runHook preBuild

            MINIMAL=1 npm run build

            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            cp -r .output $out/

            runHook postInstall
          '';
        };

        src-root = pkgs.runCommand "src-base" { } ''
          mkdir -p $out/app
          cp -r ${src}/* $out/app/
        '';

        start-dev = pkgs.writeScriptBin "start.sh" ''
          #!${pkgs.runtimeShell}

          cd /app

          export NODE_EXTRA_CA_CERTS=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt;

          ${pkgs.nodejs}/bin/npm install
          ${pkgs.nodejs}/bin/npm run dev
        '';

        prod-image = pkgs.dockerTools.buildLayeredImage {
          name = name;
          tag = version;
          contents = [
            pkgs.bashInteractive
            pkgs.coreutils
            pkgs.busybox
            pkgs.sqlite-interactive
            prod-package
          ];
          config = {
            Env = [
              "NODE_EXTRA_CA_CERTS=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            ];
            Cmd = [
              "${pkgs.nodejs}/bin/node"
              "${prod-package}/server/index.mjs"
            ];
          };
        };

        dev-image = pkgs.dockerTools.buildLayeredImage {
          name = "${name}-dev";
          tag = version;
          contents = [
            pkgs.bashInteractive
            pkgs.coreutils
            pkgs.busybox
            pkgs.cacert
            pkgs.nodejs
            src-root
            start-dev
          ];
          config = {
            Cmd = [
              "start.sh"
            ];
          };
        };

        docker_create_and_push = pkgs.writeShellScript "buildAndPush" ''
          ${pkgs.podman}/bin/podman load -i ${prod-image}

          ${pkgs.podman}/bin/podman tag localhost/${name}:${version} docker-hosted.dani-home.de/${name}:${version}
          ${pkgs.podman}/bin/podman push docker-hosted.dani-home.de/${name}:${version}
        '';

        docker_create_and_push_dev = pkgs.writeShellScript "buildAndPush" ''
          ${pkgs.podman}/bin/podman load -i ${dev-image}
        '';
      in
      {
        devShell = pkgs.mkShell {
          shellHook = ''
            export SOPS_AGE_KEY_FILE=$(pwd)/secrets/private-age-key.txt;
          '';
          buildInputs = defaultPkgs;
        };

        packages = {
          default = prod-package;
          image = prod-image;
          dev-iamge = dev-image;
        };

        apps = {
          buildAndPush = {
            type = "app";
            program = "${docker_create_and_push}";
          };
          buildAndPushDev = {
            type = "app";
            program = "${docker_create_and_push_dev}";
          };
        };
      }
    );
}
