// @ts-check
import { defineConfig } from 'astro/config';

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  base: "/xnode-auth",

  build: {
    client: "./xnode-auth",
  },

  vite: {
    ssr: {
      noExternal: true
    },
  },

  adapter: node({
    mode: "standalone",
  }),
});