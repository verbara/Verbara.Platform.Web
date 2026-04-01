import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Channels', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/channels');
  });

  test('should display channels page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('channels-page')).toBeVisible();
  });

  test('should show multiple channel cards', async ({ platformAdminPage: page }) => {
    const cards = page.locator('[class*="rounded-lg"][class*="border"]').filter({ has: page.locator('svg') });
    await expect(cards.first()).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-channels').click();
    await expect(page).toHaveURL(/\/admin\/channels/);
  });
});
