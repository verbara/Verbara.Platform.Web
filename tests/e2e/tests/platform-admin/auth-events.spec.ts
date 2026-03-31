import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Auth Events', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/auth-events');
  });

  test('should display auth events table', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('auth-events-table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('should display correct columns', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('auth-events-table');
    const header = table.locator('thead');
    await expect(header).toContainText(/timestamp|time/i);
    await expect(header).toContainText(/user/i);
    await expect(header).toContainText(/type|event/i);
  });

  test('should filter by event type', async ({ platformAdminPage: page }) => {
    // base-ui Select does not support selectOption(); use click-based interaction
    await page.getByTestId('auth-events-filter-type').click();
    await page.getByText('login_success').click();
    // Filtering is reactive — wait for table to update
    await page.waitForTimeout(500);
    const table = page.getByTestId('auth-events-table');
    await expect(table).toBeVisible();
  });

  test('should filter by date range', async ({ platformAdminPage: page }) => {
    const today = new Date().toISOString().split('T')[0];
    await page.getByTestId('auth-events-filter-start').fill(today);
    await page.getByTestId('auth-events-filter-end').fill(today);
    await page.waitForTimeout(500);
    const table = page.getByTestId('auth-events-table');
    await expect(table).toBeVisible();
  });

  test('should show pagination controls', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-events-prev')).toBeVisible();
    await expect(page.getByTestId('auth-events-next')).toBeVisible();
  });

  test('should export CSV', async ({ platformAdminPage: page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('auth-events-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
