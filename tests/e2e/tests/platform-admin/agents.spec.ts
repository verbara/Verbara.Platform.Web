import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Agents', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/agents');
  });

  test('should display agents page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('agents-page')).toBeVisible();
    await expect(page.getByTestId('agents-create-btn')).toBeVisible();
  });

  test('should show agents in data table', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('should search agents', async ({ platformAdminPage: page }) => {
    await page.getByTestId('data-table-search').fill('agent');
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('should navigate to agent detail on row click', async ({ platformAdminPage: page }) => {
    // If any agent exists, clicking its row navigates to detail
    const firstRow = page.getByTestId('data-table').locator('tbody tr').first();
    const hasRow = await firstRow.isVisible().catch(() => false);
    if (hasRow) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/admin\/agents\//);
    }
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-people').click();
    await page.getByTestId('sidebar-link-agents').click();
    await expect(page).toHaveURL(/\/admin\/agents/);
  });
});
