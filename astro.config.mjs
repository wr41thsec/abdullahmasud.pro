import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Custom domain serves from the root, so `base` stays '/'.
// `site` drives canonical URLs and og:url.
export default defineConfig({
  site: 'https://abdullahmasud.pro',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
