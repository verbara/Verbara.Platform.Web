import { test, expect } from '../../fixtures/auth.fixture';

test.describe('CDR Records', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/cdr');
  });

  test('should display CDR page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-page')).toBeVisible();
  });

  test('should show CDR data table', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-table')).toBeVisible();
  });

  test('should show export button', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-export-btn')).toBeVisible();
  });

  test('should show pagination controls', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-pagination')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByTestId('sidebar-link-cdr').click();
    await expect(page).toHaveURL(/\/analytics\/cdr/);
    await expect(page.getByTestId('cdr-page')).toBeVisible();
  });
});
