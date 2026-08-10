import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localEditorApi } from './lib/api.mjs';

const editorDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(editorDir, '..');

export default defineConfig({
  root: editorDir,
  publicDir: path.join(projectRoot, 'public'),
  plugins: [localEditorApi(projectRoot)],
  server: {
    host: '127.0.0.1',
    port: 4322,
    strictPort: true,
  },
});
