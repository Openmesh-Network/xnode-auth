{
  config,
  pkgs,
  lib,
  ...
}:
let
  cfg = config.services.xnode-auth;
  xnode-auth = pkgs.callPackage ./package.nix { };
in
{
  options = {
    services.xnode-auth = {
      enable = lib.mkEnableOption "Enable Xnode Auth";

      hostname = lib.mkOption {
        type = lib.types.str;
        default = "localhost";
        example = "0.0.0.0";
        description = ''
          The hostname under which the app should be accessible.
        '';
      };

      port = lib.mkOption {
        type = lib.types.port;
        default = 34401;
        example = 34401;
        description = ''
          The port under which the app should be accessible.
        '';
      };

      access = lib.mkOption {
        type = lib.types.attrsOf (lib.types.listOf lib.types.str);
        default = { };
        example = {
          "example.com" = [ "eth:0000000000000000000000000000000000000000" ];
          "admin.plopmenz.com" = [
            "eth:0000000000000000000000000000000000000000"
            "eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3"
          ];
        };
        description = ''
          The addresses that have access to each domain.
        '';
      };
    };
  };

  config = lib.mkIf cfg.enable {
    users.groups.xnode-auth = { };
    users.users.xnode-auth = {
      isSystemUser = true;
      group = "xnode-auth";
    };

    systemd.services.xnode-auth = {
      wantedBy = [ "multi-user.target" ];
      description = "Web3 authenticator and login dashboard.";
      after = [ "network.target" ];
      environment = lib.mkMerge [
        {
          HOSTNAME = cfg.hostname;
          PORT = toString cfg.port;
        }
        (lib.attrsets.mapAttrs (domain: accessList: builtins.toJSON accessList) cfg.access)
      ];
      serviceConfig = {
        ExecStart = "${lib.getExe xnode-auth}";
        User = "xnode-auth";
        Group = "xnode-auth";
        CacheDirectory = "nextjs-app";
      };
    };
  };
}
