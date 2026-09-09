import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localEditorApi } from './lib/api.mjs';

const editorDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(editorDir, '..');

export default defineConfig({
  root: editorDir,
  // Keep the editor's optimized dependencies separate from Astro's Vite cache.
  // Sharing node_modules/.vite lets either dev server invalidate dependency URLs
  // that are still loaded in the other server's browser tab (504 Outdated Optimize Dep).
  cacheDir: path.join(projectRoot, 'node_modules/.vite-editor'),
  publicDir: path.join(projectRoot, 'public'),
  optimizeDeps: { include: ['mermaid'] },
  plugins: [localEditorApi(projectRoot)],
  server: {
    host: '127.0.0.1',
    port: 4322,
    strictPort: true,
  },
});
