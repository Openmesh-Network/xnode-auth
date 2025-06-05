{
  inputs = {
    xnode-manager.url = "github:Openmesh-Network/xnode-manager";
    xnode-auth.url = "github:Openmesh-Network/xnode-auth";
    xnode-auth-demo.url = "github:Openmesh-Network/xnode-auth-demo";
    nixpkgs.follows = "xnode-auth-demo/nixpkgs";
  };

  nixConfig = {
    extra-substituters = [
      "https://openmesh.cachix.org"
    ];
    extra-trusted-public-keys = [
      "openmesh.cachix.org-1:du4NDeMWxcX8T5GddfuD0s/Tosl3+6b+T2+CLKHgXvQ="
    ];
  };

  outputs = inputs: {
    nixosConfigurations.container = inputs.nixpkgs.lib.nixosSystem {
      specialArgs = {
        inherit inputs;
      };
      modules = [
        inputs.xnode-manager.nixosModules.container
        inputs.xnode-auth.nixosModules.default
        inputs.xnode-auth-demo.nixosModules.default
        {
          # START USER CONFIG
          networking.hostName = "xnode-auth";
          nixpkgs.hostPlatform = "x86_64-linux";
          system.stateVersion = "25.05";
          services.xnode-auth.domains."xnode-auth-demo" = {
            accessList = [ "eth:519ce4c129a981b2cbb4c3990b1391da24e8ebf3" ];
          };
          # END USER CONFIG

          services.nginx = {
            enable = true;
            virtualHosts."xnode-auth-demo" = {
              serverName = "localhost";
              locations."/" = {
                proxyPass = "http://localhost:3000"; # xnode-auth-demo
              };
            };
          };

          services.xnode-auth.enable = true;
          services.xnode-auth-demo.enable = true; # Example application to protect
        }
      ];
    };
  };
}
