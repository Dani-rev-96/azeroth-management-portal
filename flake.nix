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
        version = "${package-json.version}";
        src = ./.;

        prod-package = pkgs.buildNpmPackage {
          name = name;
          version = version;
          src = src;

          buildInputs = [
            pkgs.nodejs
            pkgs.vips
          ];

          nativeBuildInputs = [
            pkgs.node-gyp
            pkgs.python3
            pkgs.pkg-config
            pkgs.vips
          ];

          npmDeps = pkgs.importNpmLock {
            npmRoot = src;
          };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;
          npmFlags = [ "--legacy-peer-deps" ];

          # Ensure node_modules is writable - required for Nuxt/Nitro build
          # which needs to write package.json files during bundling
          preBuild = ''
            # Remove any existing .output to ensure clean build
            rm -rf .output

            # The npmConfigHook creates node_modules as symlinks to the nix store
            # We need to make them writable for Nitro to write package.json files
            # Convert the symlinked node_modules to a writable copy
            if [ -L node_modules ] || [ -d node_modules ]; then
              tmp_modules=$(mktemp -d)
              cp -rL node_modules/* "$tmp_modules/" || true
              rm -rf node_modules
              mv "$tmp_modules" node_modules
              chmod -R u+w node_modules
            fi
          '';

          buildPhase = ''
            runHook preBuild

            # Set HOME to a writable directory for npm cache
            export HOME=$(mktemp -d)

            # Run nuxt build directly via node (bypasses broken .bin symlinks)
            MINIMAL=1 node node_modules/nuxt/bin/nuxt.mjs build

            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/
            cp -r .output/* $out/

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
        devShells = {
          default = pkgs.mkShell {
            packages = defaultPkgs;

            # nativeBuildInputs triggers the setup-hooks from linkNodeModulesHook
            nativeBuildInputs = [ pkgs.importNpmLock.hooks.linkNodeModulesHook ];

            npmDeps = pkgs.importNpmLock.buildNodeModules {
              npmRoot = src;
              nodejs = pkgs.nodejs;
              derivationArgs = {
                nativeBuildInputs = [ ];
                npmFlags = [ "--legacy-peer-deps" ];
              };
            };

            shellHook = ''
              export SOPS_AGE_KEY_FILE=$(pwd)/secrets/private-age-key.txt

              # Manually trigger node_modules linking for direnv compatibility
              if [ -n "$npmDeps" ] && [ ! -e node_modules ]; then
                ln -s "$npmDeps/node_modules" node_modules
              fi

              # Add node_modules/.bin to PATH for direct access to binaries
              export PATH="$PWD/node_modules/.bin:$PATH"
            '';
          };
        };

        packages = {
          default = prod-package;
          image = prod-image;
          dev-image = dev-image;
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
