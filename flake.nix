{
  description = "Web3 authenticator and login dashboard.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    systems.url = "github:nix-systems/default";
  };

  outputs =
    {
      self,
      nixpkgs,
      systems,
    }:
    let
      # A helper that helps us define the attributes below for
      # all systems we care about.
      eachSystem =
        f:
        nixpkgs.lib.genAttrs (import systems) (
          system:
          f {
            inherit system;
            pkgs = nixpkgs.legacyPackages.${system};
          }
        );
    in
    {
      packages = eachSystem (
        { pkgs, ... }:
        {
          default = pkgs.callPackage ./nix/package.nix { };
        }
      );

      checks = eachSystem (
        { pkgs, system, ... }:
        {
          package = self.packages.${system}.default;
          nixos-module = pkgs.callPackage ./nix/nixos-test.nix { };
        }
      );

      nixosModules.default = ./nix/nixos-module.nix;
    };
}
