import { test, expect } from '../../fixtures/auth.fixture';

test.describe('QA Evaluations', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/qa');
  });

  test('should display QA page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('qa-page')).toBeVisible();
  });

  test('should show QA data table', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('qa-table')).toBeVisible();
  });

  test('should display page title', async ({ platformAdminPage: page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByRole('link', { name: /calidad/i }).click();
    await expect(page).toHaveURL(/\/analytics\/qa/);
    await expect(page.getByTestId('qa-page')).toBeVisible();
  });
});
