import { dev } from 'astro';

// Use the API so the test server stays in the foreground, also in agent shells.
const server = await dev({ server: { host: '127.0.0.1', port: 4331 }, vite: { cacheDir: 'node_modules/.vite-astro-test' } });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await server.stop(); process.exit(0); });
