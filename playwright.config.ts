import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end flows against a production build and the mock API in e2e/mock-api.mjs.
 * Run `npm run build` first (CI does), then `npm run test:e2e`.
 * PW_CHROMIUM_PATH lets a machine with a preinstalled Chromium use it instead of downloading.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    {
      command: 'node e2e/mock-api.mjs',
      port: 4000,
      reuseExistingServer: false,
    },
    {
      command: 'npx next start -p 3000',
      port: 3000,
      reuseExistingServer: false,
      env: { API_INTERNAL_URL: 'http://localhost:4000/api/v1' },
    },
  ],
});
