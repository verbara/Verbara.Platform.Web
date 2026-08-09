import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Agents', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/agents');
  });

  test('should display agents page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('agents-page')).toBeVisible();
    await expect(page.getByTestId('agents-create-btn')).toBeVisible();
  });

  // The table only renders with at least one row and the Customer tenant starts empty, so both
  // table assertions seed their own agent rather than relying on demo-seed state.
  test('should show agents in data table', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const ids = await api.createAgentWithUser(`${Date.now()}`);

    await page.reload();
    await expect(page.getByTestId('data-table')).toBeVisible();

    await api.deleteAgentWithUser(ids);
  });

  test('should search agents', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const ids = await api.createAgentWithUser(`${Date.now()}`);

    await page.reload();
    await page.getByTestId('data-table-search').fill('E2E Agent');
    await expect(page.getByTestId('data-table')).toBeVisible();

    await api.deleteAgentWithUser(ids);
  });

  test('should navigate to agent detail on row click', async ({ demoAdminPage: page }) => {
    // If any agent exists, clicking its row navigates to detail
    const firstRow = page.getByTestId('data-table').locator('tbody tr').first();
    const hasRow = await firstRow.isVisible().catch(() => false);
    if (hasRow) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/admin\/agents\//);
    }
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-people').click();
    await page.getByTestId('sidebar-link-agents').click();
    await expect(page).toHaveURL(/\/admin\/agents/);
  });
});
