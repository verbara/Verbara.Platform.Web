import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Interval Table', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/intervals');
  });

  test('should display interval page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('interval-page')).toBeVisible();
  });

  test('should show filter controls', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('interval-filters')).toBeVisible();
  });

  test('should show interval data table', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('interval-table')).toBeVisible();
  });

  test('should show export button', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('interval-export-btn')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByRole('link', { name: /intervalos$/i }).click();
    await expect(page).toHaveURL(/\/analytics\/intervals/);
    await expect(page.getByTestId('interval-page')).toBeVisible();
  });
});
