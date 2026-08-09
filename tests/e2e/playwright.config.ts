import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // The @reference-deployment suite documents its own prerequisite — a stack from
  // docker-compose.reference-smb.yml — so it cannot pass against the regular dev stack. It runs
  // from tests/e2e/playwright.reference.config.ts instead (npm run e2e:reference).
  testIgnore: /reference-deployment\.spec\.ts/,
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
