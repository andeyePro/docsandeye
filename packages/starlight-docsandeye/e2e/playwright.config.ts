/**
 * End-to-end suite for the plugin's reader-mode interactive fixture site.
 * `npm run e2e` (repo root) builds `fixtures/site-interactive` into
 * `dist-e2e/` and runs this config, which serves that directory with
 * `serve.mjs` (a static host that honours `404.html`) and drives Chromium.
 * With `E2E_DIST` (a built Docs&I site, relative to the directory the suite
 * is started from) the fixture build is skipped and that directory is served
 * instead; see `helpers.ts` for `E2E_GUIDE`, `E2E_STEP` and `E2E_SEARCH`.
 * Browsers: `npx playwright install --with-deps chromium` once per machine.
 */
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4399);
const CI = Boolean(process.env.CI);
const DIST = process.env.E2E_DIST ? path.resolve(process.env.E2E_DIST) : path.resolve(import.meta.dirname, '../fixtures/site-interactive/dist-e2e');
const GUIDE = process.env.E2E_GUIDE || '/kit/';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node serve.mjs ${JSON.stringify(DIST)} ${PORT}`,
    url: `http://127.0.0.1:${PORT}${GUIDE}`,
    reuseExistingServer: !CI,
    timeout: 30_000,
  },
});
