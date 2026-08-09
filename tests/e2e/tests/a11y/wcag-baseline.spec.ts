import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth.fixture';
import { waitForAppReady } from '../../helpers/auth-session';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function runAxe(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test.describe('WCAG baseline (axe-core)', () => {
  test('login page has no critical or serious violations', async ({ page }) => {
    await page.goto('/login');
    const blocking = await runAxe(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('admin/users has no critical or serious violations', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/users');
    await waitForAppReady(page);
    const blocking = await runAxe(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('admin/queues has no critical or serious violations', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/queues');
    await waitForAppReady(page);
    const blocking = await runAxe(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('operations/agents has no critical or serious violations', async ({
    demoAdminPage: page,
  }) => {
    await page.goto('/operations/agents');
    await waitForAppReady(page);
    const blocking = await runAxe(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('analytics/dashboard has no critical or serious violations', async ({
    demoAdminPage: page,
  }) => {
    await page.goto('/analytics/dashboard');
    await waitForAppReady(page);
    const blocking = await runAxe(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('skip-link is focusable and targets main-content', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/users');
    // Tab is instantaneous, so it must not fire while the guard is still showing the restoring
    // skeleton — at that point the skip-link is not in the DOM and focus stays on <body>.
    await waitForAppReady(page);
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main-content');
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });
});
