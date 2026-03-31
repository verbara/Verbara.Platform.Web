import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('System Settings', () => {
  test('should display license card', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    const licenseCard = page.getByTestId('system-license-card');
    await expect(licenseCard).toBeVisible();
    await expect(licenseCard).toContainText(/community|enterprise|tier/i);
  });

  test('should display cluster status', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await expect(page.getByText(/instance/i)).toBeVisible();
  });

  test('should display at least one cluster node', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    const nodesGrid = page.getByTestId('system-nodes-grid');
    await expect(nodesGrid).toBeVisible();
    const nodeCards = nodesGrid.locator('[data-testid^="system-node-"]');
    await expect(nodeCards.first()).toBeVisible();
  });

  test('should display global settings form', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await expect(page.getByTestId('system-settings-platformName')).toBeVisible();
    await expect(page.getByTestId('system-settings-timezone')).toBeVisible();
    await expect(page.getByTestId('system-settings-language')).toBeVisible();
  });

  test('should save and persist settings change', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const original = await api.getSystemSettings();

    await page.goto('/admin/system');
    const nameInput = page.getByTestId('system-settings-platformName');
    await nameInput.clear();
    await nameInput.fill('E2E Test Platform');
    await page.getByTestId('system-settings-save').click();

    await page.reload();
    await expect(page.getByTestId('system-settings-platformName')).toHaveValue('E2E Test Platform');

    await api.updateSystemSettings(original);
  });

  test('should disable save button when no changes', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await expect(page.getByTestId('system-settings-save')).toBeDisabled();
  });

  test('should show drain button state on node', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    const drainButtons = page.locator('[data-testid^="system-node-drain-"]');
    const count = await drainButtons.count();
    if (count > 0) {
      await expect(drainButtons.first()).toBeVisible();
    }
  });
});
