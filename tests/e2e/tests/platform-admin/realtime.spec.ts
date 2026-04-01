import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Realtime — Endpoint Profiles', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/realtime');
  });

  test('should display endpoint profiles page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('realtime-page')).toBeVisible();
    await expect(page.getByTestId('realtime-create-btn')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-system').click();
    await page.getByTestId('sidebar-link-realtime').click();
    await expect(page).toHaveURL(/\/admin\/realtime/);
  });
});
