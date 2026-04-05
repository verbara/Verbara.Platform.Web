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
});
