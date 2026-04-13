import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Billing — Usage Dashboard', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/billing/usage');
  });

  test('should display usage page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('usage-page')).toBeVisible();
  });

  test('should show date range filters', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('usage-filters')).toBeVisible();
    await expect(page.locator('#usage-from')).toBeVisible();
    await expect(page.locator('#usage-until')).toBeVisible();
  });

  test('should show usage type filter', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('usage-type-filter')).toBeVisible();
  });

  test('should have default date range set to current month', async ({ platformAdminPage: page }) => {
    const fromInput = page.locator('#usage-from');
    const value = await fromInput.inputValue();
    const now = new Date();
    const expectedPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(value).toContain(expectedPrefix);
  });

  test('should show detailed records section', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('usage-records-section')).toBeVisible();
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/billing/rate-cards');
    await page.getByTestId('sidebar-link-usage').click();
    await expect(page).toHaveURL(/\/admin\/billing\/usage/);
    await expect(page.getByTestId('usage-page')).toBeVisible();
  });
});
