// R5.2 PB.2 — admin impersonation session lifecycle end-to-end smoke.
//
// Logs in as Platform Admin, opens the impersonation admin page, and exercises
// the active-session list, manual revoke (with reason), and history toggle.
// Backend seed varies by environment, so the row-click + drawer assertions
// gate on "rows render if any session exists" rather than asserting specific
// content.
//
// Gating: skipped when the impersonation admin page is not reachable
// (`platform:tenant:impersonate` permission not granted to the fixture
// account, e.g. in environments where the seeded role template doesn't
// include the new permission yet).

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Impersonation admin lifecycle', () => {
  test('should list active sessions, revoke with reason, and toggle history', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/security/impersonation');

    // Permission gate redirect — skip cleanly when the fixture account lacks the seeded
    // `platform:tenant:impersonate` permission.
    //
    // The gate has to be decided on rendered state, not on the URL. PermissionGuard redirects
    // client-side and only once the session restore has resolved the permission set, so reading
    // `page.url()` right after goto() always sees the requested path — the skip never fired and the
    // spec failed on the assertion below instead.
    const guarded = page.getByTestId('impersonation-admin-page');
    const denied = page.getByTestId('unauthorized-page');
    await expect(guarded.or(denied)).toBeVisible();

    if (await denied.isVisible()) {
      test.skip(true, 'platform:tenant:impersonate permission not granted to this fixture');
      return;
    }

    await expect(guarded).toBeVisible();
    await expect(page.getByTestId('impersonation-admin-tabs')).toBeVisible();

    // Active tab is the default — at least the empty state or rows must show.
    const empty = page.getByTestId('impersonation-admin-empty-active');
    const rowRevoke = page.locator('[data-testid^="impersonation-revoke-"]').first();
    await expect
      .poll(async () => {
        return (await empty.isVisible()) || (await rowRevoke.isVisible());
      })
      .toBe(true);

    if (await rowRevoke.isVisible()) {
      // Revoke flow opens the dialog → reason input → confirm fires the
      // mutation → the row disappears once the list refetches.
      await rowRevoke.click();
      const reason = page.getByTestId('impersonation-revoke-reason');
      await expect(reason).toBeVisible();
      await reason.fill('e2e: investigation complete');
      await page.getByTestId('impersonation-revoke-confirm').click();

      // Audit log surface (PB.1) should pick up the revoke event. Navigate
      // there and filter by action to verify the audit landed.
      await page.goto('/admin/security/audit');
      const audit = page.getByTestId('audit-viewer-page');
      if (await audit.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await page.getByTestId('audit-filter-action-prefix').fill('impersonation.session.');
        await page.getByTestId('audit-filter-apply').click();
        // Either rows show or empty — both acceptable; the contract under
        // test is that the filter UI doesn't error.
        const auditResults = page.getByTestId('audit-viewer-results');
        const auditEmpty = page.getByTestId('audit-viewer-empty');
        await expect
          .poll(async () => {
            return (await auditResults.isVisible()) || (await auditEmpty.isVisible());
          })
          .toBe(true);
      }
      await page.goto('/admin/security/impersonation');
    }

    // History tab toggle renders either the empty state or the table.
    await page.getByTestId('impersonation-admin-tab-history').click();
    const historyEmpty = page.getByTestId('impersonation-admin-empty-history');
    const historyTable = page.locator('table').first();
    await expect
      .poll(async () => {
        return (await historyEmpty.isVisible()) || (await historyTable.isVisible());
      })
      .toBe(true);
  });
});
