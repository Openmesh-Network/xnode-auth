// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  base: "/xnode-auth",

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: true
    },
  },

  adapter: node({
    mode: "standalone",
  }),
});