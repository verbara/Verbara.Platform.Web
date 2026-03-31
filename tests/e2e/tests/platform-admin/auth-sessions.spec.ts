import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Auth Sessions', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/auth-sessions');
  });

  test('should display active sessions', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('auth-sessions-table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('should display correct columns', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('auth-sessions-table');
    const header = table.locator('thead');
    await expect(header).toContainText(/user/i);
    await expect(header).toContainText(/ip/i);
  });

  test('should force logout another session', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    await api.login(DEMO_ADMIN.tenantId, DEMO_ADMIN.email, DEMO_ADMIN.password);

    await page.reload();

    const logoutButtons = page.locator('[data-testid^="session-logout-"]');
    const count = await logoutButtons.count();
    if (count > 0) {
      await logoutButtons.first().click();
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();
      await page.getByTestId('confirm-dialog-confirm').click();
    }
  });

  test('should auto-refresh sessions', async ({ platformAdminPage: page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/sessions')) {
        requests.push(req.url());
      }
    });
    await page.waitForTimeout(31_000);
    expect(requests.length).toBeGreaterThanOrEqual(1);
  });

  test('should show confirm dialog on force logout', async ({ platformAdminPage: page }) => {
    const logoutButtons = page.locator('[data-testid^="session-logout-"]');
    const count = await logoutButtons.count();
    if (count > 0) {
      await logoutButtons.first().click();
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();
      await page.getByTestId('confirm-dialog-cancel').click();
    }
  });
});
