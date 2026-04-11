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

  test('should show current session badge and disable revoke for it', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('security-sessions-list');
    await expect(table).toBeVisible();
    // Find the row with "This session" badge
    const currentRow = table.locator('tr', { hasText: /this session/i });
    await expect(currentRow).toBeVisible();
    // The revoke button for the current session should be disabled
    const revokeBtn = currentRow.locator('button', { hasText: /revoke/i });
    await expect(revokeBtn).toBeDisabled();
  });
});
