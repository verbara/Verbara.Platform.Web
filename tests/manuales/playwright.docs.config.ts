// Living-docs Playwright configuration — Fase 0 walking skeleton.
//
// This is the SECOND Playwright config in the repo, intentionally separated
// from `tests/e2e/playwright.config.ts` so the 74 existing verification specs
// keep their fast feedback loop (no `video: 'on'` overhead) while the manual-
// generation specs run with full artifact capture.
//
// What's different from the verify config:
//   - testDir is `./personas` — only persona/journey specs run here
//   - video: 'on', trace: 'on', screenshot: 'on' — capture EVERY step
//   - reporter is `allure-playwright` (stable JSON layer over trace.zip
//     internals) so the manual-renderer can read step boundaries + attachments
//     via a public API instead of reverse-engineering Playwright internals
//   - retries: 0 — a manual that needed a retry is not a documentable manual
//   - outputDir explicit so the renderer knows where to find per-test
//     screenshots emitted via `await page.screenshot({ path: ... })`
//
// Run:
//   cd Verbara.Platform.Web
//   npx playwright test -c tests/manuales/playwright.docs.config.ts
//
// Then render manuals:
//   npx tsx tests/manuales/manual-renderer/render.ts
//
// Output of test run:
//   tests/manuales/test-results/  — Playwright artifacts (videos, traces)
//   tests/manuales/allure-results/  — Allure JSON results per test
//
// Output of renderer:
//   ../../../docs/manuales/auto/v2.5.4/es/<persona>/<journey>.md + assets/

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './personas',
  testMatch: '**/*.spec.ts',
  timeout: 120_000, // a manual journey can take longer than a smoke test
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0, // see header — manual journeys are deterministic or they're broken
  workers: 1,
  outputDir: './test-results',
  reporter: [
    ['allure-playwright', { outputFolder: './allure-results', detail: true }],
    ['list'],
    ['html', { open: 'never', outputFolder: './playwright-report' }],
  ],
  use: {
    // The 00-smoke spec targets a stable public page (example.com) so the
    // pipeline can be validated end-to-end without requiring a running demo
    // stack. Fase 1 journeys will switch this to the local demo URL via env.
    baseURL: process.env.MANUAL_BASE_URL ?? 'https://example.com',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    locale: 'es-419',
    timezoneId: 'America/Bogota',
  },
  projects: [
    {
      name: 'manuales',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
