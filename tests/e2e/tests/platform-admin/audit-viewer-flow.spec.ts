// R5.2 PB.1 — admin audit viewer end-to-end smoke.
//
// Logs in as Platform Admin, navigates to /admin/security/audit, applies the
// `mfa.admin.` action prefix filter, opens the drawer for the first row, and
// verifies the export trigger fires a CSV download. Backend seed varies by
// environment, so the row-click + drawer assertions are scoped to "drawer
// renders if any row exists" rather than asserting specific content.

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Audit viewer flow', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/security/audit');
    await expect(page.getByTestId('audit-viewer-page')).toBeVisible();
  });

  test('should filter audit events by action prefix and open drawer', async ({
    demoAdminPage: page,
  }) => {
    await page.getByTestId('audit-filter-action-prefix').fill('mfa.admin.');
    await page.getByTestId('audit-filter-apply').click();

    // Either rows render or the empty state shows — both are valid outcomes
    // depending on seed data, but the filter UI must respond.
    const results = page.getByTestId('audit-viewer-results');
    const empty = page.getByTestId('audit-viewer-empty');
    await expect
      .poll(async () => {
        return (await results.isVisible()) || (await empty.isVisible());
      })
      .toBe(true);

    // The results container renders (headers and all) even when the filter matches nothing, so
    // gating on its visibility waits forever for a row that never arrives. Gate on the row count.
    const rows = results.locator('tbody tr');
    if ((await rows.count()) > 0) {
      // First row in the rendered table — click the action cell to open drawer.
      await rows.first().click();

      // Drawer Overview tab is always rendered when an event is selected.
      await expect(page.getByTestId('audit-drawer-overview')).toBeVisible();
    }
  });

  test('should download CSV export when export button clicked', async ({ demoAdminPage: page }) => {
    const exportButton = page.getByTestId('audit-export-button');
    if (!(await exportButton.isVisible())) {
      test.skip(true, 'audit.export permission not granted to this fixture');
      return;
    }

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    await page.getByTestId('audit-export-csv').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/audit-export-.*\.csv$/);
  });
});
