import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Cluster Management', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/cluster');
  });

  test('should display cluster management page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cluster-page')).toBeVisible();
    await expect(page.getByTestId('cluster-add-node-btn')).toBeVisible();
  });

  test('should show summary cards', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cluster-summary-nodes')).toBeVisible();
    await expect(page.getByTestId('cluster-summary-capacity')).toBeVisible();
    await expect(page.getByTestId('cluster-summary-agents')).toBeVisible();
    await expect(page.getByTestId('cluster-summary-instances')).toBeVisible();
  });

  test('should show nodes data table', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cluster-nodes-table')).toBeVisible();
  });

  test('should open add node sheet when clicking add button', async ({ demoAdminPage: page }) => {
    await page.getByTestId('cluster-add-node-btn').click();
    await expect(page.getByTestId('cluster-add-node-sheet')).toBeVisible();
  });

  test('should show instances section', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cluster-instances')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-system').click();
    await page.getByTestId('sidebar-link-cluster').click();
    await expect(page).toHaveURL(/\/admin\/cluster/);
  });
});
