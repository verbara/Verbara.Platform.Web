import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('DNC Lists', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/dnc-lists');
  });

  test('should display DNC lists page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('dnc-lists-page')).toBeVisible();
    await expect(page.getByTestId('dnc-lists-create-btn')).toBeVisible();
  });

  test('should create a DNC list', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E DNC ${Date.now()}`;

    await page.getByTestId('dnc-lists-create-btn').click();
    await page.getByTestId('dnc-form-name').fill(name);
    await page.getByTestId('dnc-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const lists = await api.listDncLists();
    const arr = Array.isArray(lists) ? lists : lists.items || [];
    const created = arr.find((l: any) => l.name === name);
    if (created) await api.deleteDncList(created.id);
  });

  test('should delete a DNC list with 3s confirmation', async ({
    demoAdminPage: page,
    demoApiContext,
  }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E DNC Del ${Date.now()}`;

    const res = await api.createDncList({ name });
    const created = await res.json();

    await page.reload();
    await page.getByTestId(`delete-dnc-${created.id}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-compliance').click();
    await page.getByTestId('sidebar-link-dnc-lists').click();
    await expect(page).toHaveURL(/\/admin\/dnc-lists/);
  });
});
