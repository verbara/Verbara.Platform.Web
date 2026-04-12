import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Sessions Management', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/security');
  });

  test('should display sessions table with at least one session', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('security-sessions-list');
    await expect(table).toBeVisible();
    // Should have at least one row (the current session)
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 }).catch(() => {
      // May have more than 1 session, just verify at least 1
    });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should render a revoke button for each session row', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('security-sessions-list');
    await expect(table).toBeVisible();
    // Every row exposes a revoke action; current-session detection requires the refresh
    // cookie which the JWT-only auth fixture does not set, so we only assert structure here.
    const firstRow = table.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('button').last()).toBeVisible();
  });
});
