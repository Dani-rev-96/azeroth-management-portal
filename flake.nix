{

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix2container.url = "github:nlewo/nix2container";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      nix2container,
      ...
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

        # MySQL client shipped in the images and the devShell. The game DB servers
        # run `mysql:9`; the 8.4 LTS client matches their auth/protocol, the MariaDB
        # client does not reliably (mysqldump/mysql are used for backup/restore).
        mysqlClient = pkgs.mysql84;

        # nix2container images have no /bin or /usr/bin, so the runtime tools are
        # only reachable through an explicit PATH of store paths.
        runtimePath = pkgs.lib.makeBinPath [
          pkgs.nodejs
          mysqlClient
          pkgs.gzip
          pkgs.sqlite-interactive
          pkgs.coreutils
          pkgs.bashInteractive
          pkgs.busybox
        ];

        # Env shared by the prod images. TMPDIR=/tmp expects a writable /tmp
        # (an emptyDir in the k8s deployment); the backup code resolves the MySQL
        # binaries through MYSQLDUMP_BIN / MYSQL_BIN instead of PATH lookups.
        runtimeEnv = [
          "NODE_EXTRA_CA_CERTS=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
          "PATH=${runtimePath}"
          "TMPDIR=/tmp"
          "MYSQLDUMP_BIN=${mysqlClient}/bin/mysqldump"
          "MYSQL_BIN=${mysqlClient}/bin/mysql"
        ];

        defaultPkgs = with pkgs; [
          nodejs
          deno
          mysqlClient
          sops
          age
          sqlite-interactive
          kubectl
          kubernetes-helm
          openssl
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
          # TMPDIR=/tmp (runtimeEnv) needs a writable /tmp; the k8s deployment
          # mounts an emptyDir there, the local podman image needs it baked in.
          extraCommands = "mkdir -m 1777 tmp";
          contents = [
            pkgs.bashInteractive
            pkgs.coreutils
            pkgs.busybox
            pkgs.sqlite-interactive
            mysqlClient
            pkgs.gzip
            prod-package
          ];
          config = {
            Env = runtimeEnv;
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
            mysqlClient
            pkgs.gzip
            src-root
            start-dev
          ];
          config = {
            Cmd = [
              "start.sh"
            ];
          };
        };

        # ---- GHCR publishing (nix2container) -------------------------------
        #
        # Separate from prod-image: the dockerTools output stays the local podman
        # path, this one is what CI pushes. nix2container's copyToRegistry runs
        #   skopeo --insecure-policy copy nix:<storepath> docker://<name>:<tag>
        # so the `name` below IS the push destination. Flat namespace on purpose —
        # nested ghcr.io/owner/repo/image paths have package-permission problems.
        n2c = nix2container.packages.${system}.nix2container;

        ghcrRegistry = "ghcr.io/dani-rev-96";
        ghcrSourceLabel = "https://github.com/Dani-rev-96/azeroth-management-portal";

        # Runtime layer: the toolchain the prod image ships (same package set as
        # prod-image's contents, plus nodejs/cacert which dockerTools pulled in
        # through Cmd but nix2container only takes from layer closures).
        ghcr-runtime-layer = n2c.buildLayer {
          deps = [
            pkgs.bashInteractive
            pkgs.coreutils
            pkgs.busybox
            pkgs.cacert
            pkgs.nodejs
            pkgs.sqlite-interactive
            mysqlClient
            pkgs.gzip
          ];
          maxLayers = 10;
          # Explicit for the digest-mismatch case (nix2container#127): keep the
          # layer tar deterministic so the recorded digest matches what is pushed.
          reproducible = true;
        };

        # App layer: the buildNpmPackage output, kept alone so a rebuild of the app
        # is the only layer that has to be re-uploaded.
        ghcr-app-layer = n2c.buildLayer {
          deps = [ prod-package ];
          layers = [ ghcr-runtime-layer ];
          maxLayers = 1;
          reproducible = true;
        };

        ghcr-image = n2c.buildImage {
          name = "${ghcrRegistry}/${name}";
          tag = version;
          layers = [
            ghcr-runtime-layer
            ghcr-app-layer
          ];
          config = {
            Env = runtimeEnv;
            Cmd = [
              "${pkgs.nodejs}/bin/node"
              "${prod-package}/server/index.mjs"
            ];
            # Mandatory: ties the GHCR package to this repo, which is what gives
            # the workflow's GITHUB_TOKEN write access on push.
            Labels."org.opencontainers.image.source" = ghcrSourceLabel;
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
          ghcr = ghcr-image;
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
