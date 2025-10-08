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
        default = "127.0.0.1";
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
                default = { };
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

      externalSources = lib.mkOption {
        type = lib.types.listOf (
          lib.types.submodule {
            options = {
              source = lib.mkOption {
                type = lib.types.str;
                example = "path:/var/lib/xnode-auth/dynamic.json";
                description = ''
                  Source that defines the configuration.
                '';
              };

              restrictions = {
                domains = lib.mkOption {
                  type = lib.types.str;
                  default = "^.*$";
                  example = "^manager\.xnode\.local$";
                  description = ''
                    Regex that defines allowed domains specified by this source.
                  '';
                };

                domainSpecific = lib.mkOption {
                  type = lib.types.listOf (
                    lib.types.submodule {
                      options = {
                        domains = lib.mkOption {
                          type = lib.types.str;
                          default = "^.*$";
                          example = "^manager\.xnode\.local$";
                          description = ''
                            Regex that defines which domains this restriction should be applied to.
                          '';
                        };

                        users = lib.mkOption {
                          type = lib.types.str;
                          default = "^.*$";
                          example = "^(eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3|eth:2309762aaca0a8f689463a42c0a6a84be3a7ea51)$";
                          description = ''
                            Regex that defines allowed users.
                          '';
                        };

                        paths = lib.mkOption {
                          type = lib.types.str;
                          default = "^.*$";
                          example = "^(?:\/config.*|\/file\/container:.*|\/info.*|\/process\/container:.*|\/usage.*|\/request.*)$";
                          description = ''
                            Regex that defines allowed paths.
                          '';
                        };
                      };
                    }
                  );
                  default = [ ];
                  example = [
                    {
                      # Do not allow this source to specify paths other than /private for domain xnode-auth.container
                      domains = "^xnode-auth.container$";
                      paths = "^\/private(?:\\?.*)?$";
                    }
                    {
                      # Only allow this source to give access to eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3 for any subdomain of plopmenz.com.
                      domains = "^.*\.plopmenz\.com$";
                      users = "^eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3$";
                    }
                  ];
                  description = ''
                    Restrictions that apply only to certain domains.
                  '';
                };
              };
            };
          }
        );
        default = [ ];
        example = [
          {
            # Give local file /xnode-auth.json full access over domain manager.xnode.local
            source = "path:/xnode-auth.json";
            restrictions = {
              domains = "^manager\.xnode\.local$";
            };
          }
          {
            # Give remote file https://core.openmesh.network/xnode-auth.json full access over all openmesh.network subdomains
            # Except on xnode.openmesh.network, where it is only allowed to grant access to eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3
            source = "https:core.openmesh.network/xnode-auth.json";
            restrictions = {
              domains = "^.*\.openmesh\.network$";
              domainSpecific = [
                {
                  domains = "^xnode\.openmesh\.network$";
                  users = "^eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3$";
                }
              ];
            };
          }
        ];
        description = ''
          List of external sources that define domain configurations. Each source should be properly restricted for optimal security.
        '';
      };

      config = {
        eth = {
          rpc = lib.mkOption {
            type = lib.types.str;
            default = "";
            example = "https://mainnet.base.org";
            description = ''
              Use an RPC to validate smart account signatures.
            '';
          };
        };
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

    systemd.services = lib.mkMerge (
      [
        {
          xnode-auth = {
            wantedBy = [ "multi-user.target" ];
            description = "Web3 authenticator and login dashboard.";
            after = [ "network.target" ];
            environment = {
              HOSTNAME = cfg.hostname;
              PORT = builtins.toString cfg.port;
              XNODEAUTH_EXTERNALSOURCES = builtins.toJSON cfg.externalSources;
              XNODEAUTH_MEMORY = builtins.toJSON (
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
              XNODEAUTH_CONFIG = builtins.toJSON cfg.config;
            };
            serviceConfig = {
              ExecStart = "${lib.getExe xnode-auth}";
              User = "xnode-auth";
              Group = "xnode-auth";
              CacheDirectory = "nextjs-app";
            };
          };
        }
      ]
      ++ (builtins.map (externalSource: {
        "xnode-auth-source-update-${
          builtins.replaceStrings [ "/" "-" ] [ "-" "\x2d" ] externalSource.source
        }" =
          {
            description = "Update Xnode Auth external source ${externalSource.source}.";
            serviceConfig = {
              User = "xnode-auth";
              Group = "xnode-auth";
            };
            path = [ pkgs.curl ];
            script = ''
              curl http://${cfg.hostname}:${builtins.toString cfg.port}/xnode-auth/api/internal/update_source --request POST --header "Content-Type: application/json" --data '{ "id": "${externalSource.source}" }'
            '';
          };
      }) cfg.externalSources)
    );

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
              proxyPass = "http://127.0.0.1:${builtins.toString cfg.port}";
              extraConfig = ''
                proxy_set_header Host $server_name;
              '';
            };
            "${cfg.nginxConfig.subpath}/api/internal" = {
              extraConfig = ''
                return 403;
              '';
            };
            "${cfg.nginxConfig.subpath}/api/validate" = {
              proxyPass = "http://127.0.0.1:${builtins.toString cfg.port}${cfg.nginxConfig.subpath}/api/validate";
              extraConfig = ''
                proxy_set_header Host $server_name;
                proxy_set_header Path $request_uri;

                proxy_pass_request_body off;
                proxy_set_header Content-Length "";

                if ($request_method = OPTIONS ) {
                  return 200;
                }
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
