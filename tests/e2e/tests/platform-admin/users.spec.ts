import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Users', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/users');
  });

  test('should display users page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('users-page')).toBeVisible();
    await expect(page.getByTestId('users-create-btn')).toBeVisible();
  });

  test('should show users in data table', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('should search users', async ({ platformAdminPage: page }) => {
    await page.getByTestId('data-table-search').fill('platform');
    await expect(page.getByText('platform@admin.local')).toBeVisible();
  });

  test('should create a user via form', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const email = `e2e-user-${Date.now()}@test.local`;

    await page.getByTestId('users-create-btn').click();
    await page.getByTestId('user-form-email').fill(email);
    await page.getByTestId('user-form-displayName').fill('E2E Test User');
    await page.getByTestId('user-form-submit').click();

    await page.getByTestId('data-table-search').fill(email);
    await expect(page.getByTestId('data-table').getByText(email)).toBeVisible({ timeout: 5000 });

    const users = await api.listUsers();
    const list = Array.isArray(users) ? users : users.items || [];
    const created = list.find((u: any) => u.email === email);
    if (created) await api.deleteUser(created.id);
  });

  test('should show validation for empty email', async ({ platformAdminPage: page }) => {
    await page.getByTestId('users-create-btn').click();
    await page.getByTestId('user-form-displayName').fill('Test');
    await page.getByTestId('user-form-submit').click();
    await expect(page.getByTestId('user-form-email')).toBeVisible();
  });

  test('should navigate to user detail on row click', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const email = `e2e-detail-${Date.now()}@test.local`;

    const res = await api.createUser({ email, displayName: 'E2E Detail', role: 'agent' });
    const created = await res.json();

    await page.reload();
    await page.getByTestId('data-table-search').fill(email);
    await page.getByTestId('data-table').getByText(email).click();

    await expect(page).toHaveURL(/\/admin\/users\//);
    await expect(page.getByTestId('user-detail-page')).toBeVisible();

    await api.deleteUser(created.id);
  });

  test('should edit user from detail page', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const email = `e2e-edit-${Date.now()}@test.local`;
    const newName = `Edited ${Date.now()}`;

    const res = await api.createUser({ email, displayName: 'Before Edit', role: 'agent' });
    const created = await res.json();

    await page.goto(`/admin/users/${created.id}`);
    await page.getByTestId('user-edit-btn').click();
    await page.getByTestId('user-form-displayName').clear();
    await page.getByTestId('user-form-displayName').fill(newName);
    await page.getByTestId('user-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(newName)).toBeVisible();

    await api.deleteUser(created.id);
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-people').click();
    await page.getByTestId('sidebar-link-users').click();
    await expect(page).toHaveURL(/\/admin\/users/);
  });
});
