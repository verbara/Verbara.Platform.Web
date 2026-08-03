import { defineConfig, devices } from '@playwright/test';

/**
 * Config for the `@reference-deployment` suite.
 *
 * That suite validates the SMB customer-facing reference deploy and states its own prerequisite:
 * a stack brought up via `docker-compose.reference-smb.yml`. Running it against the regular dev
 * stack fails for environmental reasons, not product ones, so the main config ignores it and it
 * gets this dedicated entry point instead:
 *
 *   npx playwright test -c tests/e2e/playwright.reference.config.ts
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /reference-deployment\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
