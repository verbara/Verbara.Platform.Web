import { test, expect } from '../../fixtures/auth.fixture';

test.describe('QA Evaluations', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/qa');
  });

  test('should display QA page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('qa-page')).toBeVisible();
  });

  test('should show QA data table', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('qa-table')).toBeVisible();
  });

  test('should display page title', async ({ demoAdminPage: page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByTestId('sidebar-link-qa').click();
    await expect(page).toHaveURL(/\/analytics\/qa/);
    await expect(page.getByTestId('qa-page')).toBeVisible();
  });
});
