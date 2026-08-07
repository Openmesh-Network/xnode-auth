// @ts-check
import { defineConfig } from 'astro/config';

import node from "@astrojs/node";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  base: "/xnode-auth",

  vite: {
    ssr: {
      noExternal: true
    },

    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: "standalone",
  }),
});