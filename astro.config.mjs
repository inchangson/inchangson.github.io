import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://inchangson.github.io',
  vite: {
    cacheDir: 'node_modules/.vite-astro',
    optimizeDeps: { include: ['mermaid'] },
  },
});
