// 00-smoke — Fase 0 walking skeleton for the living-docs pipeline.
//
// Goal: prove the full pipeline works end-to-end with the minimum possible
// scenario. The "manual" here is intentionally trivial — 2 steps, 2
// screenshots — so we can validate:
//   1. Playwright captures per-step screenshots via the screenshot: 'on' use
//      option PLUS our explicit page.screenshot({ path: '...' }) calls that
//      tag each capture by a stable step-ID.
//   2. allure-playwright emits per-step JSON we can parse in the renderer.
//   3. The template engine substitutes {{step:NN}} placeholders with the
//      correct screenshot paths.
//   4. The final .md is readable in a Markdown viewer (VSCode preview / git).
//
// Once this passes, Fase 1 swaps the target URL + scenario for the real SMB
// Owner Day 1 journey.

import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const PERSONA = 'smb-owner';
const JOURNEY = '00-smoke';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Screenshots emitted explicitly land here. The renderer reads this same
// directory to resolve {{step:NN}} placeholders.
const screenshotsDir = path.resolve(__dirname, '../../test-results/screenshots', PERSONA, JOURNEY);

fs.mkdirSync(screenshotsDir, { recursive: true });

/**
 * Take a screenshot AND tag it with a stable step ID, so the renderer can
 * match `{{step:welcome}}` in the template to the right PNG regardless of
 * test execution order or rename refactors.
 */
async function captureStep(page: import('@playwright/test').Page, stepId: string): Promise<void> {
  const target = path.join(screenshotsDir, `step-${stepId}.png`);
  await page.screenshot({ path: target, fullPage: true });
}

test.describe('SMB Owner — Smoke (pipeline walking skeleton)', () => {
  test('captures two steps against a stable public page', async ({ page }) => {
    await test.step('Abrir la página de bienvenida', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Example/i);
      await captureStep(page, 'welcome');
    });

    await test.step('Validar el contenido principal', async () => {
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await captureStep(page, 'content');
    });
  });
});
