import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
  });

  test('should display dashboard page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });

  test('should show KPI cards section', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('dashboard-kpis')).toBeVisible();
  });

  test('should show charts section', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('dashboard-charts')).toBeVisible();
  });

  test('should display page title', async ({ demoAdminPage: page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/cdr');
    await page.getByTestId('sidebar-link-dashboard').click();
    await expect(page).toHaveURL(/\/analytics\/dashboard/);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });
});
