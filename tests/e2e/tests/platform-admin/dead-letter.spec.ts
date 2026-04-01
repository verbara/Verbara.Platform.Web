import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Dead Letter Queue', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/webhooks/dead-letter');
  });

  test('should display dead letter page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('dead-letter-page')).toBeVisible();
  });

  test('should show empty state without search', async ({ platformAdminPage: page }) => {
    await expect(page.getByText('Enter a tenant ID to view dead-letter deliveries.')).toBeVisible();
    await expect(page.getByTestId('dead-letter-search-btn')).toBeDisabled();
  });

  test('should search by tenant ID', async ({ platformAdminPage: page }) => {
    await page.getByTestId('dead-letter-tenant-input').fill('platform');
    await page.getByTestId('dead-letter-search-btn').click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/webhooks');
    await page.getByTestId('sidebar-group-integrations').click();
    await page.getByTestId('sidebar-link-dead-letter').click();
    await expect(page).toHaveURL(/\/admin\/webhooks\/dead-letter/);
    await expect(page.getByTestId('dead-letter-page')).toBeVisible();
  });
});
