import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Reports', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/reports');
  });

  test('should display reports page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('reports-page')).toBeVisible();
    await expect(page.getByTestId('reports-create-btn')).toBeVisible();
  });
});
