import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Audit Log', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/audit');
  });

  test('should display audit entries', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('audit-table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('should display correct columns', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('audit-col-action')).toBeVisible();
    await expect(page.getByTestId('audit-col-entityType')).toBeVisible();
    await expect(page.getByTestId('audit-col-entityId')).toBeVisible();
  });

  test('should filter by action', async ({ platformAdminPage: page }) => {
    await page.getByTestId('audit-filter-action').fill('create');
    await page.getByTestId('audit-search-button').click();

    const table = page.getByTestId('audit-table');
    await expect(table).toBeVisible();
  });

  test('should filter by entity type', async ({ platformAdminPage: page }) => {
    await page.getByTestId('audit-filter-entityType').fill('User');
    await page.getByTestId('audit-search-button').click();

    const table = page.getByTestId('audit-table');
    await expect(table).toBeVisible();
  });

  test('should show pagination controls', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('audit-prev')).toBeVisible();
    await expect(page.getByTestId('audit-next')).toBeVisible();
  });
});
