import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Trunks', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/trunks');
  });

  test('should display trunks page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('trunks-page')).toBeVisible();
    await expect(page.getByTestId('trunks-create-btn')).toBeVisible();
  });

  test('should show trunks in data table', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-trunk-${Date.now()}`;

    const res = await api.createTrunk({ name, displayName: 'E2E Trunk', type: 'SIP', maxChannels: 30, isActive: true });
    const created = await res.json();

    await page.reload();
    // Paginated list — filter to ensure visibility regardless of leftover rows.
    await page.getByTestId('trunks-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    await api.deleteTrunk(created.id);
  });

  test('should create a trunk via form', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-create-trunk-${Date.now()}`;

    await page.getByTestId('trunks-create-btn').click();
    await page.getByTestId('trunk-form-name').fill(name);
    await page.getByTestId('trunk-form-displayName').fill('E2E Created');
    await page.getByTestId('trunk-form-maxChannels').clear();
    await page.getByTestId('trunk-form-maxChannels').fill('30');
    await page.getByTestId('trunk-form-submit').click();

    // Paginated list; filter by name to make the assertion deterministic
    // regardless of leftover rows from prior runs.
    await page.getByTestId('trunks-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    const trunks = await api.listTrunks();
    const list = Array.isArray(trunks) ? trunks : trunks.items || [];
    const created = list.find((t: any) => t.name === name);
    if (created) await api.deleteTrunk(created.id);
  });

  test('should search trunks by name', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-search-trunk-${Date.now()}`;

    const res = await api.createTrunk({ name, displayName: 'E2E Search', type: 'SIP', maxChannels: 10 });
    const created = await res.json();

    await page.reload();
    await page.getByTestId('trunks-search').fill(name);
    await page.waitForTimeout(500);
    await expect(page.getByText(name)).toBeVisible();

    await api.deleteTrunk(created.id);
  });

  test('should filter active only', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-inactive-trunk-${Date.now()}`;

    const res = await api.createTrunk({ name, displayName: 'Inactive', type: 'SIP', maxChannels: 10, isActive: false });
    const created = await res.json();

    await page.reload();
    await page.getByTestId('trunks-active-only').check();
    await page.waitForTimeout(300);
    await expect(page.getByText(name)).not.toBeVisible();

    await api.deleteTrunk(created.id);
  });

  test('should delete a trunk with 3s confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-del-trunk-${Date.now()}`;

    const res = await api.createTrunk({ name, displayName: 'E2E Delete', type: 'SIP', maxChannels: 10 });
    const created = await res.json();

    await page.reload();
    // Filter so the delete button for this specific trunk is always rendered.
    // Wait for the debounced search (300ms) to settle and the row to appear in
    // the filtered view before clicking — this keeps the subsequent delete flow
    // deterministic against the paginated table.
    await page.getByTestId('trunks-search').fill(name);
    await expect(
      page.getByTestId('data-table').getByText(name),
    ).toBeVisible();
    await page.getByTestId(`delete-trunk-${created.id}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Clear the search so the table re-renders from the (freshly invalidated)
    // allTrunks list rather than the stale by-name query; verify the row is
    // gone. The toast message also quotes the trunk name, so scope the
    // visibility assertion to the table.
    await page.getByTestId('trunks-search').fill('');
    await expect(
      page.getByTestId('data-table').getByText(name),
    ).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-telephony').click();
    await page.getByTestId('sidebar-link-trunks').click();
    await expect(page).toHaveURL(/\/admin\/trunks/);
  });
});
