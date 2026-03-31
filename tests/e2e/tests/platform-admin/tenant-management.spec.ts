import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Tenant Management', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/tenants');
  });

  test('should display tenant list with platform and demo', async ({ platformAdminPage: page }) => {
    await expect(page.getByText('platform')).toBeVisible();
    await expect(page.getByText('demo')).toBeVisible();
  });

  test('should display correct table columns', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('data-table');
    await expect(table).toBeVisible();
    await expect(table).toContainText(/name/i);
    await expect(table).toContainText(/status/i);
  });

  test('should filter tenants by search', async ({ platformAdminPage: page }) => {
    await page.getByTestId('data-table-search').fill('demo');
    await expect(page.getByText('demo')).toBeVisible();
  });

  test('should create a new tenant', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const tenantId = `e2e-create-${Date.now()}`;
    await page.getByTestId('tenants-create-button').click();
    await page.getByTestId('tenants-form-tenantId').fill(tenantId);
    await page.getByTestId('tenants-form-name').fill('E2E Test Tenant');
    await page.getByTestId('tenants-form-submit').click();

    await expect(page.getByText(tenantId)).toBeVisible();

    const api = new ApiHelper(authenticatedApiContext);
    await api.deleteTenant(tenantId);
  });

  test('should reject invalid tenantId format', async ({ platformAdminPage: page }) => {
    await page.getByTestId('tenants-create-button').click();
    await page.getByTestId('tenants-form-tenantId').fill('INVALID!ID');
    await page.getByTestId('tenants-form-name').fill('Bad Tenant');
    await page.getByTestId('tenants-form-submit').click();

    await expect(page.getByTestId('tenants-create-sheet')).toBeVisible();
  });

  test('should edit a tenant', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const tenantId = `e2e-edit-${Date.now()}`;
    await api.createTenant({ tenantId, name: 'Edit Me' });
    await page.reload();

    await page.getByTestId(`tenant-edit-${tenantId}`).click();
    await page.getByTestId('tenants-edit-name').clear();
    await page.getByTestId('tenants-edit-name').fill('Edited Name');
    await page.getByTestId('tenants-edit-submit').click();

    await expect(page.getByText('Edited Name')).toBeVisible();

    await api.deleteTenant(tenantId);
  });

  test('should suspend a tenant', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const tenantId = `e2e-suspend-${Date.now()}`;
    await api.createTenant({ tenantId, name: 'Suspend Me' });
    await page.reload();

    await page.getByTestId(`tenant-edit-${tenantId}`).click();
    await page.getByTestId('tenants-edit-status').selectOption('suspended');
    await page.getByTestId('tenants-edit-submit').click();

    await expect(page.getByTestId(`tenant-status-${tenantId}`)).toContainText(/suspended/i);

    await api.deleteTenant(tenantId);
  });

  test('should reactivate a suspended tenant', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const tenantId = `e2e-reactivate-${Date.now()}`;
    await api.createTenant({ tenantId, name: 'Reactivate Me' });
    await page.reload();

    await page.getByTestId(`tenant-edit-${tenantId}`).click();
    await page.getByTestId('tenants-edit-status').selectOption('suspended');
    await page.getByTestId('tenants-edit-submit').click();

    await page.getByTestId(`tenant-edit-${tenantId}`).click();
    await page.getByTestId('tenants-edit-status').selectOption('active');
    await page.getByTestId('tenants-edit-submit').click();

    await expect(page.getByTestId(`tenant-status-${tenantId}`)).toContainText(/active/i);

    await api.deleteTenant(tenantId);
  });

  test('should delete a tenant with confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const tenantId = `e2e-delete-${Date.now()}`;
    await api.createTenant({ tenantId, name: 'Delete Me' });
    await page.reload();

    await page.getByTestId(`tenant-delete-${tenantId}`).click();
    const confirmBtn = page.getByTestId('confirm-dialog-confirm');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(page.getByText(tenantId)).not.toBeVisible();
  });

  test('should not allow deleting platform tenant', async ({ platformAdminPage: page }) => {
    const deleteBtn = page.getByTestId('tenant-delete-platform');
    const count = await deleteBtn.count();
    if (count > 0) {
      await deleteBtn.click();
      const confirmBtn = page.getByTestId('confirm-dialog-confirm');
      await page.waitForTimeout(3500);
      await confirmBtn.click();
      await expect(page.getByText(/cannot delete|error/i)).toBeVisible();
    }
  });
});
