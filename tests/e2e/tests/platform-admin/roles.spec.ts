import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Roles', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/roles');
  });

  test('should display roles page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('roles-page')).toBeVisible();
    await expect(page.getByTestId('roles-create-btn')).toBeVisible();
  });

  test('should create a role', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Role ${Date.now()}`;

    await page.getByTestId('roles-create-btn').click();
    await page.getByTestId('role-form-name').fill(name);
    await page.getByTestId('role-form-description').fill('Test role from E2E');
    await page.getByTestId('role-form-submit').click();

    await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });

    const roles = await api.listRoles();
    const list = Array.isArray(roles) ? roles : roles.items || [];
    const created = list.find((r: any) => r.name === name);
    if (created) await api.deleteRole(created.roleId);
  });

  test('should clone a role', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Clone Src ${Date.now()}`;
    const cloneName = `E2E Clone ${Date.now()}`;

    const res = await api.createRole({ name, description: 'source' });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`clone-role-${created.roleId}`).click();
    await page.getByTestId('role-clone-name').clear();
    await page.getByTestId('role-clone-name').fill(cloneName);
    await page.getByTestId('role-clone-submit').click();

    await expect(page.getByText(cloneName)).toBeVisible({ timeout: 5000 });

    // Cleanup both
    const roles = await api.listRoles();
    const list = Array.isArray(roles) ? roles : roles.items || [];
    const clone = list.find((r: any) => r.name === cloneName);
    if (clone) await api.deleteRole(clone.roleId);
    await api.deleteRole(created.roleId);
  });

  test('should delete a non-default role with 3s confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Del Role ${Date.now()}`;

    const res = await api.createRole({ name });
    const created = await res.json();

    await page.reload();

    // Roles table is not paginated server-side, but we still target the row by its
    // generated testid rather than the role's name text to avoid any locale drift.
    await page.getByTestId(`delete-role-${created.roleId}`).click();

    // ConfirmDeleteDialog carries a 3-second countdown — the destructive pattern
    // used across tenants / teams / billing / surveys. Roles was the last holdout
    // on the instant ConfirmDialog; this test locks in the new behavior.
    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // The row carries the `delete-role-${roleId}` action button — wait for that
    // testid to disappear rather than matching role name text, which briefly
    // co-exists in both the deleted row and the success toast (strict-mode violation).
    await expect(page.getByTestId(`delete-role-${created.roleId}`)).toHaveCount(0, { timeout: 5000 });
  });

  test('should navigate to role detail on row click', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Detail Role ${Date.now()}`;

    const res = await api.createRole({ name });
    const created = await res.json();

    await page.reload();

    await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/admin\/roles\//);

    await api.deleteRole(created.roleId);
  });
});
