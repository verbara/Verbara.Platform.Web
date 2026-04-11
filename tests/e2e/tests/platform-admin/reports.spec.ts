import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Reports', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/reports');
  });

  test('should display reports page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('reports-page')).toBeVisible();
    await expect(page.getByTestId('reports-create-btn')).toBeVisible();
  });

  test('should show run and history buttons for seeded report', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const report = await api.createReport({
      name: `E2E Report ${Date.now()}`,
      type: 'CDRSummary',
      schedule: '0 8 * * *',
      format: 'CSV',
      isActive: true,
    });

    await page.reload();
    await expect(page.getByTestId(`report-run-${report.id}`)).toBeVisible();
    await expect(page.getByTestId(`report-history-${report.id}`)).toBeVisible();

    await api.deleteReport(report.id);
  });

  test('should open history sheet when clicking history button', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const report = await api.createReport({
      name: `E2E History ${Date.now()}`,
      type: 'CDRSummary',
      schedule: '0 8 * * *',
      format: 'CSV',
      isActive: true,
    });

    await page.reload();
    await page.getByTestId(`report-history-${report.id}`).click();
    await expect(page.getByTestId('report-history-sheet')).toBeVisible();

    await api.deleteReport(report.id);
  });
});
