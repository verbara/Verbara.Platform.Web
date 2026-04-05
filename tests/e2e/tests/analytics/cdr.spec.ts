import { test, expect } from '../../fixtures/auth.fixture';

test.describe('CDR Records', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/cdr');
  });

  test('should display CDR page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('cdr-page')).toBeVisible();
  });

  test('should show CDR data table', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('cdr-table')).toBeVisible();
  });

  test('should show export button', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('cdr-export-btn')).toBeVisible();
  });

  test('should show pagination controls', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('cdr-pagination')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByRole('link', { name: /registros de llamadas/i }).click();
    await expect(page).toHaveURL(/\/analytics\/cdr/);
    await expect(page.getByTestId('cdr-page')).toBeVisible();
  });
});
