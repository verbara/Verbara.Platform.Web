import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Dialer Settings', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/dialer-settings');
  });

  test('should display dialer settings page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('dialer-settings-page')).toBeVisible();
    await expect(page.getByTestId('dialer-settings-save-btn')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-system').click();
    await page.getByTestId('sidebar-link-dialer-settings').click();
    await expect(page).toHaveURL(/\/admin\/dialer-settings/);
  });
});
