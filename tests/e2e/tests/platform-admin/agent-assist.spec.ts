import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Agent Assist Configuration', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/agent-assist');
  });

  test('should display agent assist config page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('agent-assist-config-page')).toBeVisible();
  });

  test('should show engine status section', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('agent-assist-section-status')).toBeVisible();
  });

  test('should show keyword rules section', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('agent-assist-section-keyword-rules')).toBeVisible();
  });

  test('should show compliance rules section', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('agent-assist-section-compliance-rules')).toBeVisible();
  });

  test('should show coming soon banner and disable form', async ({ platformAdminPage: page }) => {
    // The coming soon banner should be visible
    await expect(page.getByText(/coming soon/i)).toBeVisible();
    await expect(page.getByText(/speech recognition/i)).toBeVisible();

    // Form should be disabled (wrapped in disabled fieldset)
    const fieldset = page.locator('fieldset[disabled]');
    await expect(fieldset).toBeVisible();
  });
});
