import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Caller ID Pools', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/caller-id-pools');
  });

  test('should display caller ID pools page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('caller-id-pools-page')).toBeVisible();
    await expect(page.getByTestId('caller-id-pools-create-btn')).toBeVisible();
  });

  test('should create a pool', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Pool ${Date.now()}`;

    await page.getByTestId('caller-id-pools-create-btn').click();
    await page.getByTestId('pool-form-name').fill(name);
    await page.getByTestId('pool-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const pools = await api.listCallerIdPools();
    const list = Array.isArray(pools) ? pools : pools.items || [];
    const created = list.find((p: any) => p.name === name);
    if (created) await api.deleteCallerIdPool(created.id);
  });

  test('should delete a pool with 3s confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Del Pool ${Date.now()}`;

    const res = await api.createCallerIdPool({ name });
    const created = await res.json();

    await page.reload();
    await page.getByTestId(`delete-pool-${created.id}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-telephony').click();
    await page.getByTestId('sidebar-link-caller-id-pools').click();
    await expect(page).toHaveURL(/\/admin\/caller-id-pools/);
  });
});
