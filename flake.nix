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

                              alias = lib.mkOption {
                                type = lib.types.nullOr lib.types.str;
                                default = null;
                                example = "admin";
                                description = ''
                                  Alias for this user (the alias: prefix is appended automatically).
                                  The alias is sent in Xnode-Auth-User instead of the raw user (which is in Xnode-Auth-User-Raw).
                                  If set, roles on this entry are ignored: roles are matched against the alias.
                                '';
                              };
                            };
                          }
                        );
                        default = { };
                        example = {
                          "ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3" = {
                            alias = "plopmenz";
                          };
                          "alias:plopmenz" = {
                            roles = [ "admin" ];
                          };
                        };
                        description = ''
                          Users to roles/alias mapping.
                        '';
                      };

                      userPatterns = lib.mkOption {
                        type = lib.types.listOf (
                          lib.types.submodule {
                            options = {
                              patterns = lib.mkOption {
                                type = lib.types.listOf lib.types.str;
                                example = [ "^ethereum:.*$" ];
                                description = ''
                                  Regexes of users this rule applies to.
                                  All regexes in the group must match the user.
                                '';
                              };
                              roles = lib.mkOption {
                                type = lib.types.listOf lib.types.str;
                                example = [ "user" ];
                                description = ''
                                  Roles granted to users matching the pattern.
                                '';
                              };
                            };
                          }
                        );
                        default = [ ];
                        example = [
                          {
                            patterns = [ "^(?!ip:).*$" ];
                            roles = [ "user" ];
                          }
                        ];
                        description = ''
                          User pattern to roles mapping.
                        '';
                      };

                      roles = lib.mkOption {
                        type = lib.types.attrsOf (
                          lib.types.submodule {
                            options = {
                              pathPatterns = lib.mkOption {
                                type = lib.types.listOf (lib.types.listOf lib.types.str);
                                example = [
                                  [
                                    "^\\/admin$"
                                    "^(?!\\/admin\\/super)"
                                    "^(?!\\/admin\\/edit)"
                                  ]
                                  [
                                    "^\\/secret$"
                                  ]
                                ];
                                description = ''
                                  Path pattern this role has access to.
                                  Access is granted if all regex in some group match the normalized path (percent-decoded, no query string).
                                '';
                              };
                            };
                          }
                        );
                        default = { };
                        example = {
                          "user" = {
                            pathPatterns = [ [ "^\\/user\\/profile$" ] ];
                          };
                          "admin" = {
                            pathPatterns = [ [ ".*" ] ];
                          };
                        };
                        description = ''
                          Role to allowed path patterns mapping.
                        '';
                      };

                      locations = lib.mkOption {
                        type = lib.types.listOf lib.types.str;
                        default = [ "/" ];
                        example = [
                          "/admin"
                          "/secret"
                        ];
                        description = ''
                          Nginx locations to protect.
                        '';
                      };

                      config = {
                        loginPage = lib.mkOption {
                          type = lib.types.str;
                          default = cfg.nginxConfig.subpath;
                          example = "/xnode-monetization";
                          description = ''
                            The subpath of the login page to redirect unauthenticated users to.
                            The login page is always served on the config signatureDomain (or the protected domain itself when it is empty).
                          '';
                        };

                        signatureDomain = lib.mkOption {
                          type = lib.types.str;
                          default = "";
                          example = "auth.example.com";
                          description = ''
                            The domain that runs the xnode-auth login page and whose name is used in the signed message.
                            Protected domains redirect to it for login, and signatures made for this domain are accepted when validating them (SSO across subdomains).
                            Defaults to the protected domain itself.
                          '';
                        };

                        cookieDomain = lib.mkOption {
                          type = lib.types.str;
                          default = "";
                          example = ".example.com";
                          description = ''
                            The Domain attribute of the session cookies, so they are shared across subdomains for SSO (e.g. auth.example.com and app.example.com).
                            Note that this exposes the signature cookie to all subdomains of that domain; apps still verify the signature themselves.
                            Defaults to host-only cookies.
                          '';
                        };

                        signatureExpiry = lib.mkOption {
                          type = lib.types.int;
                          default = 7 * 24 * 60 * 60;
                          example = 3600;
                          description = ''
                            Validity of a signature in seconds.
                            Signatures with a timestamp older than this are rejected.
                          '';
                        };

                        ethereum = {
                          rpc = lib.mkOption {
                            type = lib.types.listOf lib.types.str;
                            default = [ ];
                            example = [ "https://mainnet.base.org" ];
                            description = ''
                              RPCs used to validate smart account signatures.
                              A signature that is valid on any of the RPCs is accepted.
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
                    userPatterns = [
                      {
                        patterns = [ "^(?!ip:).*$" ];
                        roles = [ "user" ];
                      }
                    ];
                    roles = {
                      "user" = {
                        pathPatterns = [ [ ".*" ] ];
                      };
                    };
                  };
                  "admin.plopmenz.com" = {
                    users = {
                      "ethereum:0000000000000000000000000000000000000000" = {
                        roles = [ "secret-admin" ];
                      };
                      # Roles of aliased users are defined on the alias
                      "alias:plopmenz" = {
                        roles = [
                          "admin"
                          "secret-admin"
                        ];
                      };
                      "ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3" = {
                        alias = "plopmenz";
                      };
                    };
                    roles = {
                      "secret-admin" = {
                        pathPatterns = [ [ "^\/secret-admin$" ] ];
                      };
                      "admin" = {
                        pathPatterns = [ [ "^\/admin$" ] ];
                      };
                    };
                    locations = [
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

                      cacheDuration = lib.mkOption {
                        type = lib.types.int;
                        default = 60;
                        example = 10;
                        description = ''
                          How long (in seconds) fetched data from this source is cached before it is refetched.
                        '';
                      };

                      restrictions = {
                        domains = lib.mkOption {
                          type = lib.types.str;
                          default = "^$";
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
                                  example = "^manager\\.xnode\\.local$";
                                  description = ''
                                    Regex that defines which domains this restriction should be applied to.
                                  '';
                                };

                                users = {
                                  key = lib.mkOption {
                                    type = lib.types.str;
                                    default = "^$";
                                    example = "^ethereum:.*$";
                                    description = ''
                                      Regex that defines the user keys this source is allowed to define in users.
                                    '';
                                  };

                                  value = {
                                    roles = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^(?!admin$).*$";
                                      description = ''
                                        Regex applied to every role this source is allowed to assign to a user in users.
                                      '';
                                    };

                                    alias = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^(?!admin$).*$";
                                      description = ''
                                        Regex applied to every alias this source is allowed to assign to a user in users.
                                      '';
                                    };
                                  };
                                };

                                userPatterns = {
                                  key = lib.mkOption {
                                    type = lib.types.str;
                                    default = "^$";
                                    example = "^ethereum:.*$";
                                    description = ''
                                      Regex enforced on the matched user for userPatterns this source is allowed to define.
                                    '';
                                  };

                                  value = {
                                    roles = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^(?!admin$).*$";
                                      description = ''
                                        Regex applied to every role this source is allowed to assign in userPatterns.
                                      '';
                                    };
                                  };
                                };

                                roles = {
                                  key = lib.mkOption {
                                    type = lib.types.str;
                                    default = "^$";
                                    example = "^user$";
                                    description = ''
                                      Regex that defines the role keys this source is allowed to define in roles.
                                    '';
                                  };

                                  value = {
                                    pathPatterns = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^\\/public$";
                                      description = ''
                                        Patterns added to all path patterns this source defines on a role in roles.
                                      '';
                                    };
                                  };
                                };

                                config = {
                                  loginPage = lib.mkOption {
                                    type = lib.types.str;
                                    default = "^$";
                                    example = "^/xnode-auth$";
                                    description = ''
                                      Regex applied to the config loginPage value this source is allowed to set.
                                    '';
                                  };

                                  signatureDomain = lib.mkOption {
                                    type = lib.types.str;
                                    default = "^$";
                                    example = "^auth\\.example\\.com$";
                                    description = ''
                                      Regex applied to the config signatureDomain value this source is allowed to set.
                                    '';
                                  };

                                  cookieDomain = lib.mkOption {
                                    type = lib.types.str;
                                    default = "^$";
                                    example = "^\\.example\\.com$";
                                    description = ''
                                      Regex applied to the config cookieDomain value this source is allowed to set.
                                    '';
                                  };

                                  signatureExpiry = lib.mkOption {
                                    type = lib.types.str;
                                    default = "^$";
                                    example = "^[0-9]+$";
                                    description = ''
                                      Regex applied to the config signatureExpiry value (in seconds) this source is allowed to set.
                                    '';
                                  };

                                  ethereum = {
                                    rpc = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^https://.*\\.base\\.org$";
                                      description = ''
                                        Regex applied to every config ethereum rpc this source is allowed to add.
                                      '';
                                    };
                                  };

                                  appkit = {
                                    projectid = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^[0-9a-f]{32}$";
                                      description = ''
                                        Regex applied to the config appkit projectid this source is allowed to set.
                                      '';
                                    };

                                    networks = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^eip155:.*$";
                                      description = ''
                                        Regex applied to every config appkit network this source is allowed to add.
                                      '';
                                    };
                                  };

                                  password = {
                                    user = lib.mkOption {
                                      type = lib.types.str;
                                      default = "^$";
                                      example = "^(?!admin$).*$";
                                      description = ''
                                        Regex applied to every config password user key this source is allowed to define.
                                      '';
                                    };
                                  };
                                };
                              };
                            }
                          );
                          default = [ ];
                          example = [
                            {
                              # Only allow this source to define aliases (except admin) for domain xnode-auth.container, no role definitions
                              domains = "^xnode-auth.container$";
                              users = {
                                key = "^.*$";
                                value = {
                                  roles = "^$";
                                  alias = "^(?!admin$).*$";
                                };
                              };
                            }
                            {
                              # Only allow this source to define the user ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3 with role user for any subdomain of plopmenz.com
                              domains = "^.*\\.plopmenz\\.com$";
                              users = {
                                key = "^ethereum:519ce4c129a981b2cbb4c3990b1391da24e8ebf3$";
                                value.roles = "^user$";
                              };
                            }
                          ];
                          description = ''
                            Restrictions that apply only to certain domains.
                            They limit which users, userPatterns, roles, and config a source is allowed to define on the matching domains.
                            All restriction fields default to "^$" (denied), so everything has to be explicitly allowed (least privilege).
                            If no entry matches a domain, the source is unrestricted on that domain (still limited by restrictions.domains).
                            Definitions that are not allowed are ignored.
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
                    # Except on xnode.openmesh.network, where it is only allowed to grant the "user" role
                    source = "https:core.openmesh.network/xnode-auth.json";
                    restrictions = {
                      domains = "^.*\.openmesh\.network$";
                      domainSpecific = [
                        {
                          domains = "^xnode\.openmesh\.network$";
                          users = {
                            key = "^.*$";
                            value.roles = "^user$";
                          };
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
                              auth_request_set $auth_resp_xnode_auth_user_raw $upstream_http_xnode_auth_user_raw;
                              auth_request_set $auth_resp_xnode_auth_redirect $upstream_http_xnode_auth_redirect;
                              proxy_set_header Xnode-Auth-User $auth_resp_xnode_auth_user;
                              proxy_set_header Xnode-Auth-User-Raw $auth_resp_xnode_auth_user_raw;
                              error_page 401 = @login;
                            '';
                          }
                        ) access.locations
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
                            proxy_set_header X-Forwarded-Proto $scheme;
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
                            proxy_set_header X-Forwarded-Proto $scheme;

                            proxy_pass_request_body off;
                            proxy_set_header Content-Length "";

                            if ($request_method = OPTIONS ) {
                              return 200;
                            }
                          '';
                        };
                        "@login" = {
                          return = "302 $auth_resp_xnode_auth_redirect";
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
