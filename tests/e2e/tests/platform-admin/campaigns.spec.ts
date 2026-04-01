import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Campaigns', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/campaigns');
  });

  test('should display campaigns page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('campaigns-page')).toBeVisible();
    await expect(page.getByTestId('campaigns-create-btn')).toBeVisible();
  });

  test('should navigate to wizard on create', async ({ platformAdminPage: page }) => {
    await page.getByTestId('campaigns-create-btn').click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/new/);
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-campaigns').click();
    await expect(page).toHaveURL(/\/admin\/campaigns/);
  });
});
