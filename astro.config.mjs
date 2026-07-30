import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Custom domain serves from the root, so `base` stays '/'.
// `site` drives canonical URLs and og:url.
export default defineConfig({
  site: 'https://abdullahmasud.pro',
  trailingSlash: 'ignore',
  // The dev toolbar floats over the bottom-centre of the viewport, which is
  // exactly where the theme hint sits. Off, so dev looks like production.
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
