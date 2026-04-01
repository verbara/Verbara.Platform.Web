import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Purge Log', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/purge-log');
  });

  test('should display purge log page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('purge-log-page')).toBeVisible();
  });

  test('should show filter controls', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('purge-log-filter-tenant')).toBeVisible();
    await expect(page.getByTestId('purge-log-filter-from')).toBeVisible();
    await expect(page.getByTestId('purge-log-filter-to')).toBeVisible();
  });

  test('should apply tenant filter', async ({ platformAdminPage: page }) => {
    await page.getByTestId('purge-log-filter-tenant').fill('platform');
    await page.getByRole('button', { name: /apply/i }).click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/gdpr');
    await page.getByTestId('sidebar-group-compliance').click();
    await page.getByTestId('sidebar-link-purge-log').click();
    await expect(page).toHaveURL(/\/admin\/purge-log/);
    await expect(page.getByTestId('purge-log-page')).toBeVisible();
  });
});
