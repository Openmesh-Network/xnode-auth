{
  inputs = {
    xnode-builders.url = "github:Openmesh-Network/xnode-builders";
  };

  nixConfig = {
    extra-substituters = [
      "https://openmesh.cachix.org"
    ];
    extra-trusted-public-keys = [
      "openmesh.cachix.org-1:du4NDeMWxcX8T5GddfuD0s/Tosl3+6b+T2+CLKHgXvQ="
    ];
  };

  outputs =
    inputs:
    inputs.xnode-builders.language.auto {
      src = ./.;
      framework = "astro-node-noext";
      module = {
        network = false;
        storage = false;
        defaultEnable = { cfg, ... }: cfg.domains != { };
        options =
          {
            cfg,
            config,
            pkgs,
            lib,
            ...
          }:
          {
            host = {
              option = {
                type = lib.types.str;
                default = "127.0.0.1";
                example = "0.0.0.0";
                description = ''
                  The address the app should bind to.
                '';
              };
              does = { value, service, ... }: service { environment.HOST = value; };
            };

            port = {
              option = {
                type = lib.types.port;
                default = 34401;
                example = 34401;
                description = ''
                  The port the app should bind to.
                '';
              };
              does = { value, service, ... }: service { environment.PORT = builtins.toString value; };
            };

            domains = {
              option = {
                type = lib.types.attrsOf (
                  lib.types.submodule {
                    options = {
                      accessList = {
                        users = lib.mkOption {
                          type = lib.types.attrsOf (
                            lib.types.submodule {
                              options = {
                                roles = lib.mkOption {
                                  type = lib.types.listOf lib.types.str;
                                  default = [ ];
                                  example = [
                                    "sysadmin"
                                    "moderator"
                                  ];
                                  description = ''
                                    Roles on this domain to grant to this user.
                                  '';
                                };
                              };
                            }
                          );
                          default = { };
                          example = {
                            "regex:^ethereum:*.$" = {
                              roles = [ "user" ];
                            };
                            "ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3" = {
                              roles = [ "admin" ];
                            };
                          };
                          description = ''
                            Users to roles mapping.
                          '';
                        };

                        roles = lib.mkOption {
                          type = lib.types.attrsOf (
                            lib.types.submodule {
                              options = {
                                paths = lib.mkOption {
                                  type = lib.types.str;
                                  default = ".*";
                                  example = "^(?:\/admin|\/secret)(?:\?.*)?$";
                                  description = ''
                                    Regex of paths this role has access to.
                                  '';
                                };
                              };
                            }
                          );
                          default = { };
                          example = {
                            "user" = {
                              paths = "^\/user\/profile(?:\?.*)?$";
                            };
                            "admin" = { };
                          };
                          description = ''
                            Role to allowed paths mapping.
                          '';
                        };
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

                      loginPage = lib.mkOption {
                        type = lib.types.str;
                        default = cfg.nginxConfig.subpath;
                        example = "/xnode-monetization";
                        description = ''
                          The subpath to redirect unauthenticated users to.
                        '';
                      };

                      config = {
                        ethereum = {
                          rpc = lib.mkOption {
                            type = lib.types.str;
                            default = "";
                            example = "https://mainnet.base.org";
                            description = ''
                              Use an RPC to validate smart account signatures.
                            '';
                          };
                        };

                        appkit = {
                          projectid = lib.mkOption {
                            type = lib.types.str;
                            default = "6afdeb3a0496b33061a69538819a9a7e";
                            example = "6afdeb3a0496b33061a69538819a9a7e";
                            description = ''
                              Use a different reown appkit project id.
                            '';
                          };

                          networks = lib.mkOption {
                            type = lib.types.listOf lib.types.str;
                            default = [ "eip155:1" ];
                            example = [
                              "eip155:1"
                              "eip155:8453"
                              "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
                            ];
                            description = ''
                              Use a different reown appkit network selection.
                            '';
                          };
                        };

                        password = {
                          user = lib.mkOption {
                            type = lib.types.attrsOf (
                              lib.types.submodule {
                                options = {
                                  password = lib.mkOption {
                                    type = lib.types.str;
                                    example = "hunter12";
                                    description = ''
                                      Password of this user.
                                    '';
                                  };
                                };
                              }
                            );
                            default = { };
                            example = {
                              "plopmenz" = {
                                password = "hunter12";
                              };
                            };
                            description = ''
                              Set the users which can be logged into with password authentication.
                            '';
                          };
                        };
                      };
                    };
                  }
                );
                default = { };
                example = {
                  "example.com" = {
                    accessList = {
                      users = {
                        "regex:^ethereum:*.$" = {
                          roles = [ "user" ];
                        };
                      };
                      roles = {
                        "user" = { };
                      };
                    };
                  };
                  "admin.plopmenz.com" = {
                    accessList = {
                      users = {
                        "ethereum:0000000000000000000000000000000000000000" = {
                          roles = [ "secret-admin" ];
                        };
                        "ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3" = {
                          roles = [
                            "admin"
                            "secret-admin"
                          ];
                        };
                      };
                      roles = {
                        "secret-admin" = {
                          paths = "^\/secret-admin(?:\?.*)?$";
                        };
                        "admin" = {
                          paths = "^\/admin(?:\?.*)?$";
                        };
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
              does =
                { value, service, ... }:
                service {
                  environment.XNODEAUTH_MEMORY = builtins.toJSON (
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
                          ) access)
                        ]
                      ) [ ] value
                    )
                  );
                };
            };

            externalSources = {
              option = {
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
                                  example = "^(ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3|ethereum:2309762aaca0a8f689463a42c0a6a84be3a7ea51)$";
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
                              # Only allow this source to give access to ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3 for any subdomain of plopmenz.com.
                              domains = "^.*\.plopmenz\.com$";
                              users = "^ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3$";
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
                    # Except on xnode.openmesh.network, where it is only allowed to grant access to ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3
                    source = "https:core.openmesh.network/xnode-auth.json";
                    restrictions = {
                      domains = "^.*\.openmesh\.network$";
                      domainSpecific = [
                        {
                          domains = "^xnode\.openmesh\.network$";
                          users = "^ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3$";
                        }
                      ];
                    };
                  }
                ];
                description = ''
                  List of external sources that define domain configurations. Each source should be properly restricted for optimal security.
                '';
              };
              does =
                { value, service, ... }: service { environment.XNODEAUTH_EXTERNALSOURCES = builtins.toJSON value; };
            };

            nginxConfig = {
              option = {
                type = lib.types.submodule {
                  options = {
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
                default = { };
              };
              does =
                { value, ... }:
                lib.mkIf value.enable {
                  services.nginx.virtualHosts = lib.attrsets.mapAttrs (domain: access: {
                    extraConfig = ''
                      # Breaks redirects when nginx is running on non-default ports, but proxied from default port
                      port_in_redirect off;
                    '';
                    locations = lib.mkMerge [
                      (builtins.listToAttrs (
                        builtins.map (
                          location:
                          lib.attrsets.nameValuePair location {
                            extraConfig = ''
                              auth_request /xnode-auth/api/validate;
                              auth_request_set $auth_resp_xnode_auth_user $upstream_http_xnode_auth_user;
                              auth_request_set $auth_resp_xnode_auth_deny_reason $upstream_http_xnode_auth_deny_reason;
                              proxy_set_header Xnode-Auth-User $auth_resp_xnode_auth_user;
                              error_page 401 = @login;
                            '';
                          }
                        ) access.paths
                      ))
                      {
                        "^~ ${cfg.nginxConfig.subpath}/" = {
                          alias = "${cfg.package}/share/dist/client/";
                        };
                        "^~ ${cfg.nginxConfig.subpath}/_astro/" = {
                          alias = "${cfg.package}/share/dist/client/_astro/";
                          extraConfig = ''
                            add_header Cache-Control "public, max-age=31536000, immutable";
                          '';
                        };
                        "^~ ${cfg.nginxConfig.subpath}/api" = {
                          proxyPass = "http://127.0.0.1:${builtins.toString cfg.port}${cfg.nginxConfig.subpath}/api";
                          extraConfig = ''
                            proxy_set_header Host $server_name;
                          '';
                        };
                        "^~ ${cfg.nginxConfig.subpath}/api/internal" = {
                          extraConfig = ''
                            return 403;
                          '';
                        };
                        "^~ ${cfg.nginxConfig.subpath}/api/validate" = {
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
                          return = "302 $scheme://$host${access.loginPage}/?redirect=$scheme://$host$request_uri&rejected=$auth_resp_xnode_auth_deny_reason";
                        };
                      }
                    ];
                  }) cfg.domains;
                };
            };
          };
      };
    };
}
