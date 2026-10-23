import { defineConfig, devices } from '@playwright/test';

/**
 * Two-device sync suite (T8, S11).
 *
 * Runs the real Worker locally (isolated D1, Access bypass on loopback) behind the Vite
 * proxy, with two browser contexts acting as two devices. Kept out of the default suite so
 * `npm run test:e2e` stays fast and independent of wrangler.
 */
const PORT = 5179;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORKER_URL = 'http://127.0.0.1:8787/api/health';

export default defineConfig({
  testDir: './e2e-sync',
  testMatch: '**/*.sync.e2e.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'sync', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bash scripts/dev-worker.sh',
      url: WORKER_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
