import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Interval Table', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/intervals');
  });

  test('should display interval page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('interval-page')).toBeVisible();
  });

  test('should show filter controls', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('interval-filters')).toBeVisible();
  });

  test('should show interval data table', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('interval-table')).toBeVisible();
  });

  test('should show export button', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('interval-export-btn')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByTestId('sidebar-link-intervals').click();
    await expect(page).toHaveURL(/\/analytics\/intervals/);
    await expect(page.getByTestId('interval-page')).toBeVisible();
  });
});
