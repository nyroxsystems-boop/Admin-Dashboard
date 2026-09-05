import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Partsunion Admin-Dashboard
 *
 * Run:   npx playwright test
 * UI:    npx playwright test --ui
 * Debug: npx playwright test --debug
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,

  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: process.env.BASE_URL || 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  /* In CI, build & preview a static bundle. Locally, expect a running dev server. */
  webServer: process.env.CI
    ? {
        command: 'npm run preview -- --port 5174',
        port: 5174,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
