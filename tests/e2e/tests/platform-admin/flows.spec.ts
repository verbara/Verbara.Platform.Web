import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Flows', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/flows');
  });

  test('should display flows page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('flows-page')).toBeVisible();
    await expect(page.getByTestId('flows-create-btn')).toBeVisible();
  });

  test('should show flows in data table', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Flow ${Date.now()}`;

    await api.createFlow({ name });
    await page.reload();

    await expect(page.getByText(name)).toBeVisible();

    const flows = await api.listFlows();
    const created = flows.find((f: any) => f.name === name);
    if (created) {
      // Flows may not have a delete API; cleanup is best-effort
    }
  });

  test('should navigate to designer on row click', async ({
    demoAdminPage: page,
    demoApiContext,
  }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Designer Flow ${Date.now()}`;

    await api.createFlow({ name });
    await page.reload();

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/admin\/flows\//);
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-flows').click();
    await expect(page).toHaveURL(/\/admin\/flows/);
  });
});
