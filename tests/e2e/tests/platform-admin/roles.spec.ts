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
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

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
    await page.waitForTimeout(600);

    await expect(page.getByText(cloneName)).toBeVisible();

    // Cleanup both
    const roles = await api.listRoles();
    const list = Array.isArray(roles) ? roles : roles.items || [];
    const clone = list.find((r: any) => r.name === cloneName);
    if (clone) await api.deleteRole(clone.roleId);
    await api.deleteRole(created.roleId);
  });

  test('should delete a non-default role', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Del Role ${Date.now()}`;

    const res = await api.createRole({ name });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`delete-role-${created.roleId}`).click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should navigate to role detail on row click', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Detail Role ${Date.now()}`;

    const res = await api.createRole({ name });
    const created = await res.json();

    await page.reload();

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/admin\/roles\//);

    await api.deleteRole(created.roleId);
  });
});
