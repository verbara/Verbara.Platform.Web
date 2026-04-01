import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('System Settings', () => {
  test('should display license card', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    const licenseCard = page.getByTestId('system-license-card');
    await expect(licenseCard).toBeVisible();
    await expect(licenseCard).toContainText(/status|valid|expired|license/i);
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

});
