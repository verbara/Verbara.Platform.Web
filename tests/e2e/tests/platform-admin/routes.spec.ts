import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Routes', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/routes');
  });

  test('should display routes page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('routes-page')).toBeVisible();
    await expect(page.getByTestId('routes-create-btn')).toBeVisible();
  });

  test('should show routes in sortable table', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const trunkName = `e2e-route-trunk-${Date.now()}`;

    const trunkRes = await api.createTrunk({ name: trunkName, displayName: 'Route Trunk', type: 'SIP', maxChannels: 10 });
    const trunk = await trunkRes.json();

    const routeRes = await api.createRoute({ pattern: `1${Date.now()}`, patternType: 'prefix', trunkId: trunk.id, priority: 1 });
    const route = await routeRes.json();

    await page.reload();
    // Sortable table should have grip handles
    await expect(page.locator('table')).toBeVisible();

    await api.deleteRoute(route.id);
    await api.deleteTrunk(trunk.id);
  });

  test('should create a route', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const trunkName = `e2e-create-route-trunk-${Date.now()}`;
    const trunkDisplayName = `E2E Route Trunk ${Date.now()}`;
    const pattern = `9${Date.now()}`;

    const trunkRes = await api.createTrunk({ name: trunkName, displayName: trunkDisplayName, type: 'SIP', maxChannels: 10 });
    const trunk = await trunkRes.json();

    await page.reload();
    await page.getByTestId('routes-create-btn').click();
    await page.getByTestId('route-form-pattern').fill(pattern);
    await page.getByTestId('route-form-priority').clear();
    await page.getByTestId('route-form-priority').fill('1');

    // Trunk is a required Zod field — pick the one we just created via the
    // shadcn Select (role=combobox / role=option, not native <select>).
    // The select renders displayName, not name.
    await page.getByTestId('route-form-trunkId').click();
    await page.getByRole('option', { name: trunkDisplayName }).click();

    await page.getByTestId('route-form-submit').click();

    // Routes render in a sortable (dnd-kit) list for manage-capable users —
    // no pagination, all rows in the DOM. Playwright finds any matching
    // text regardless of scroll position, so a direct assertion is enough.
    await expect(page.getByText(pattern)).toBeVisible();

    const routes = await api.listRoutes();
    const list = Array.isArray(routes) ? routes : routes.items || [];
    const created = list.find((r: any) => r.pattern === pattern);
    if (created) await api.deleteRoute(created.id);
    await api.deleteTrunk(trunk.id);
  });

  test('should delete a route with 3s confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const trunkName = `e2e-del-route-trunk-${Date.now()}`;

    const trunkRes = await api.createTrunk({ name: trunkName, displayName: 'Del Route Trunk', type: 'SIP', maxChannels: 10 });
    const trunk = await trunkRes.json();

    const routeRes = await api.createRoute({ pattern: `8${Date.now()}`, patternType: 'prefix', trunkId: trunk.id, priority: 1 });
    const route = await routeRes.json();

    await page.reload();
    // Sortable (non-paginated) list — the delete button is always in the DOM.
    await page.getByTestId(`delete-route-${route.id}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await api.deleteTrunk(trunk.id);
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-telephony').click();
    await page.getByTestId('sidebar-link-routes').click();
    await expect(page).toHaveURL(/\/admin\/routes/);
  });
});
