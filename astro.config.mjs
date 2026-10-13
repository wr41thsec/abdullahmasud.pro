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
  // GitHub Pages can't send headers, so CSP goes in a <meta> tag. Astro adds
  // script-src/style-src hashes itself; the rest locks everything else to self.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
      // Cards pass --i/--tint-* as style="" attributes. Attribute styles
      // can't run script, so allowing them costs nothing.
      styleDirective: {
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
