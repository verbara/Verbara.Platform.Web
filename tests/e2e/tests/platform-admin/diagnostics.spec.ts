import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Diagnostics', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system/diagnostics');
  });

  test('should display platform status card', async ({ platformAdminPage: page }) => {
    const card = page.getByTestId('diag-platform-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/version/i);
  });

  test('should display license card', async ({ platformAdminPage: page }) => {
    const card = page.getByTestId('diag-license-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/tier/i);
  });

  test('should display cluster nodes table', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('diag-nodes-table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('should auto-refresh data', async ({ platformAdminPage: page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/cluster')) {
        requests.push(req.url());
      }
    });

    await page.waitForTimeout(16_000);
    expect(requests.length).toBeGreaterThanOrEqual(1);
  });
});
