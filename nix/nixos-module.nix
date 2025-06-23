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

      domains = lib.mkOption {
        type = lib.types.attrsOf (
          lib.types.submodule {
            options = {
              accessList = lib.mkOption {
                type = lib.types.attrsOf (
                  lib.types.submodule {
                    options = {
                      paths = lib.mkOption {
                        type = lib.types.str;
                        default = ".*";
                        example = "^(?:\/admin|\/secret)(?:\?.*)?$";
                        description = ''
                          Regex of paths to protect with the accessList authentication.
                        '';
                      };
                    };
                  }
                );
                example = {
                  "regex:^eth:*.$" = {
                    paths = "^\/user\/profile(?:\?.*)?$";
                  };
                  "eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3" = { };
                };
                description = ''
                  Users to which access is granted.
                '';
              };

              paths = lib.mkOption {
                type = lib.types.listOf lib.types.str;
                default = [ "/" ];
                example = [
                  "/admin"
                  "/secret"
                ];
                description = ''
                  Paths to protect with the accessList authentication.
                '';
              };
            };
          }
        );
        default = { };
        example = {
          "example.com" = {
            accessList = {
              "regex:^eth:*.$" = { };
            };
          };
          "admin.plopmenz.com" = {
            accessList = {
              "eth:0000000000000000000000000000000000000000" = {
                paths = "^\/secret-admin(?:\?.*)?$";
              };
              "eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3" = {
                paths = "^\/admin(?:\?.*)?$";
              };
            };
            paths = [
              "/secret-admin"
              "/admin"
            ];
          };
        };
        description = ''
          Domain configuration of each domain that wants to use xnode-auth. Should match desired nginx virtualHost name.
        '';
      };

      nginxConfig = {
        enable = lib.mkOption {
          type = lib.types.bool;
          default = true;
          example = false;
          description = ''
            Update the Nginx config to add auth to the configured domains and paths.
          '';
        };

        subpath = lib.mkOption {
          type = lib.types.str;
          default = "/xnode-auth";
          example = "/auth";
          description = ''
            The subpath used for xnode-auth endpoints.
          '';
        };
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
      environment = {
        HOSTNAME = cfg.hostname;
        PORT = toString cfg.port;
        XNODEAUTH_ACCESSLIST = builtins.toJSON (
          builtins.listToAttrs (
            lib.attrsets.foldlAttrs (
              acc: domain: access:
              acc
              ++ [
                (lib.attrsets.nameValuePair (
                  if (config.services.nginx.virtualHosts.${domain}.serverName == null) then
                    domain
                  else
                    config.services.nginx.virtualHosts.${domain}.serverName
                ) access.accessList)
              ]
            ) [ ] cfg.domains
          )
        );
      };
      serviceConfig = {
        ExecStart = "${lib.getExe xnode-auth}";
        User = "xnode-auth";
        Group = "xnode-auth";
        CacheDirectory = "nextjs-app";
      };
    };

    services.nginx.virtualHosts = lib.mkIf cfg.nginxConfig.enable (
      lib.attrsets.mapAttrs (domain: access: {
        locations = lib.mkMerge [
          (builtins.listToAttrs (
            builtins.map (
              location:
              lib.attrsets.nameValuePair location {
                extraConfig = ''
                  auth_request /xnode-auth/api/validate;
                  auth_request_set $auth_resp_xnode_auth_user $upstream_http_xnode_auth_user;
                  proxy_set_header Xnode-Auth-User $auth_resp_xnode_auth_user;
                  error_page 401 = @login;
                '';
              }
            ) access.paths
          ))
          {
            "${cfg.nginxConfig.subpath}" = {
              proxyPass = "http://localhost:${builtins.toString cfg.port}";
              extraConfig = ''
                proxy_set_header Host $server_name;
              '';
            };
            "${cfg.nginxConfig.subpath}/api/validate" = {
              proxyPass = "http://localhost:${builtins.toString cfg.port}${cfg.nginxConfig.subpath}/api/validate";
              extraConfig = ''
                proxy_set_header Host $server_name;
                proxy_set_header Path $request_uri;

                proxy_pass_request_body off;
                proxy_set_header Content-Length "";
              '';
            };
            "@login" = {
              return = "302 $scheme://$host${cfg.nginxConfig.subpath}?redirect=$scheme://$host$request_uri";
            };
          }
        ];
      }) cfg.domains
    );
  };
}
