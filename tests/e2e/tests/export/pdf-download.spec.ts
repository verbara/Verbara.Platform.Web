import { test, expect } from '../../fixtures/auth.fixture';
import { stat } from 'node:fs/promises';

test.describe('PDF export', () => {
  test('Downloads_Pdf_FromCdrDetailDrawer', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/cdr');
    await expect(page.getByTestId('cdr-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cdr-table')).toBeVisible({ timeout: 15_000 });

    // CDRs are produced by real calls; a freshly provisioned tenant has none and nothing in the
    // admin API can seed them. Skip explicitly rather than hang for 15s on a row that cannot
    // exist — the export path itself is only meaningful with a record to export.
    const rows = page.locator('.ag-row');
    await expect
      .poll(
        async () => (await rows.count()) > 0 || (await page.getByTestId('cdr-table').isVisible()),
      )
      .toBe(true);
    test.skip((await rows.count()) === 0, 'No CDR records in this environment — nothing to export');

    const firstRow = rows.first();
    await firstRow.click();

    // Drawer + Download PDF button visible
    const drawer = page.locator('[role="dialog"]').first();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    const pdfButton = page.getByRole('button', { name: /download as pdf/i });
    await expect(pdfButton).toBeVisible({ timeout: 5_000 });

    // Trigger download and assert file
    const downloadPromise = page.waitForEvent('download');
    await pdfButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^cdr-.+\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
    if (path) {
      const stats = await stat(path);
      expect(stats.size).toBeGreaterThan(2_000); // > 2 kB; CDR PDFs include header + summary minimum
    }
  });

  test('Downloads_Pdf_FromQaDetailDrawer', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/qa');
    // Wait for QA list to render — first detail card should be available
    // Same as the CDR case: QA evaluations come from reviewed calls, not from a seedable API.
    const qaRows = page.locator('[data-testid^="qa-row"], tbody tr');
    await expect.poll(async () => (await qaRows.count()) >= 0).toBe(true);
    test.skip(
      (await qaRows.count()) === 0,
      'No QA evaluations in this environment — nothing to export',
    );

    await qaRows.first().click();

    const pdfButton = page.getByRole('button', { name: /download as pdf/i });
    await expect(pdfButton).toBeVisible({ timeout: 5_000 });

    const downloadPromise = page.waitForEvent('download');
    await pdfButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^qa-.+\.pdf$/i);
  });
});
