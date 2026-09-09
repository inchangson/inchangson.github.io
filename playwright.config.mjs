import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4332',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'darwin' ? 'chrome' : undefined),
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'npm run editor -- --port 4332', url: 'http://127.0.0.1:4332', reuseExistingServer: !process.env.CI },
    { command: 'node tests/serve-blog.mjs', url: 'http://127.0.0.1:4331', reuseExistingServer: !process.env.CI },
  ],
});
