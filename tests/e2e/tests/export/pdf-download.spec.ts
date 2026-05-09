import { test, expect } from '../../fixtures/auth.fixture';
import { stat } from 'node:fs/promises';

test.describe('PDF export', () => {
  test('Downloads_Pdf_FromCdrDetailDrawer', async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/cdr');
    await expect(page.getByTestId('cdr-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cdr-table')).toBeVisible({ timeout: 15_000 });

    // Open the first row's detail drawer (ag-grid uses .ag-row)
    const firstRow = page.locator('.ag-row').first();
    await firstRow.waitFor({ state: 'visible', timeout: 15_000 });
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

  test('Downloads_Pdf_FromQaDetailDrawer', async ({ platformAdminPage: page }) => {
    await page.goto('/analytics/qa');
    // Wait for QA list to render — first detail card should be available
    const firstQaRow = page.locator('[data-testid^="qa-row"], tbody tr').first();
    await firstQaRow.waitFor({ state: 'visible', timeout: 15_000 });
    await firstQaRow.click();

    const pdfButton = page.getByRole('button', { name: /download as pdf/i });
    await expect(pdfButton).toBeVisible({ timeout: 5_000 });

    const downloadPromise = page.waitForEvent('download');
    await pdfButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^qa-.+\.pdf$/i);
  });
});
