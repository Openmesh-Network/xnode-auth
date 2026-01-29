{ pkgs }:
pkgs.buildNpmPackage {
  pname = "xnode-auth";
  version = "2.0.0";
  src = ../astro-app;

  npmDeps = pkgs.importNpmLock {
    npmRoot = ../astro-app;
  };
  npmConfigHook = pkgs.importNpmLock.npmConfigHook;

  # Add a shebang to the server js file, then patch the shebang to use a nixpkgs nodes binary
  postBuild = ''
    sed -i '1s|^|#!/usr/bin/env node\n|' dist/server/entry.mjs
    patchShebangs dist/server/entry.mjs
  '';

  installPhase = ''
    mkdir -p $out/{share,bin}

    cp -r dist/* $out/share

    chmod +x $out/share/server/entry.mjs

    makeWrapper $out/share/server/entry.mjs $out/bin/xnode-auth
  '';

  doDist = false;

  meta = {
    mainProgram = "xnode-auth";
  };
}
