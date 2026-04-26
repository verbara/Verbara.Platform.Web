import { test, expect } from '../../fixtures/auth.fixture';

/**
 * R5.2 PA.1 — MFA admin E2E.
 *
 * Gated behind `E2E_FULL_STACK=true` because the flow exercises the full
 * `/management/mfa/*` backend surface against a live Platform API. Without
 * the flag we skip — matches the convention used by other security specs.
 */
const FULL_STACK = process.env.E2E_FULL_STACK === 'true';

test.describe('MFA Admin (PA.1)', () => {
  test.skip(!FULL_STACK, 'E2E_FULL_STACK gate; run with E2E_FULL_STACK=true');

  test('NavigatesToPage_ListsUsers_ResetsMfa_AndAuditEntryAppears', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/security/mfa');

    // Page surface + filter panel render.
    await expect(page.getByTestId('mfa-admin-page')).toBeVisible();
    await expect(page.getByTestId('mfa-admin-filters')).toBeVisible();

    // Filter by tenant — the demo seed includes the host tenant + at least
    // one user under it. Switching the filter triggers a refetch and the row
    // count should remain >= 1.
    await page.getByTestId('mfa-admin-filter-tenant').fill('platform');

    // Pick the first user row — its testid encodes the user id.
    const firstRow = page.locator('[data-testid^="mfa-admin-user-"]').first();
    await expect(firstRow).toBeVisible();
    const userIdMatch = await firstRow.getAttribute('data-testid');
    const userId = userIdMatch?.replace('mfa-admin-user-', '') ?? '';
    expect(userId).not.toBe('');

    // Reset MFA → confirm via type-to-confirm "RESET" word.
    await page.getByTestId(`mfa-admin-reset-${userId}`).click();
    await page.getByTestId('confirm-delete-word-input').fill('RESET');
    await page.getByTestId('confirm-delete-btn').click();

    // Audit log should now have a `mfa.admin.reset` entry referencing this
    // user. We hit the existing audit page rather than the API directly so
    // the assertion matches what an operator would see.
    await page.goto('/admin/audit');
    await page.getByTestId('audit-filter-action').fill('mfa.admin.reset');
    await page.getByTestId('audit-search-button').click();
    await expect(page.getByTestId('audit-table')).toContainText('mfa.admin.reset');
  });
});
