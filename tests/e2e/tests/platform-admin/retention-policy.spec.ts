import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Retention Policy', () => {
  test('should open retention policy sheet from tenant row', async ({
    platformAdminPage: page,
    authenticatedApiContext,
  }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const tenantId = `e2e-ret-${Date.now()}`;
    await api.createTenant({ tenantId, name: 'Retention Test' });

    await page.goto('/admin/tenants');
    await page.getByTestId(`tenant-retention-${tenantId}`).click();

    await expect(page.getByTestId('retention-sheet')).toBeVisible();

    await api.updateRetentionPolicy(tenantId, {
      conversationRetentionDays: null,
      authEventRetentionDays: null,
      auditRetentionDays: null,
      usageRecordRetentionDays: null,
    });
    await api.deleteTenant(tenantId);
  });

  test('should display retention fields with toggles', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/tenants');
    await page.getByTestId('tenant-retention-demo').click();

    const sheet = page.getByTestId('retention-sheet');
    await expect(sheet).toBeVisible();

    const switches = sheet.getByRole('switch');
    await expect(switches).toHaveCount(4);

    await expect(sheet.getByText('Conversation Retention')).toBeVisible();
    await expect(sheet.getByText('Auth Event Retention')).toBeVisible();
  });

  test('should toggle field on and show input', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/tenants');
    await page.getByTestId('tenant-retention-demo').click();

    const sheet = page.getByTestId('retention-sheet');
    await expect(sheet).toBeVisible();

    const firstSwitch = sheet.getByRole('switch').first();
    const isChecked = await firstSwitch.getAttribute('aria-checked');

    if (isChecked === 'true') {
      // Toggle OFF then ON to ensure a clean state with input visible
      await firstSwitch.click();
      await firstSwitch.click();
    } else {
      await firstSwitch.click();
    }

    await expect(sheet.locator('input[type="number"]').first()).toBeVisible();
  });

  test('should save retention policy', async ({
    platformAdminPage: page,
    authenticatedApiContext,
  }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const tenantId = `e2e-ret-save-${Date.now()}`;
    await api.createTenant({ tenantId, name: 'Retention Save Test' });

    await page.goto('/admin/tenants');
    await page.getByTestId(`tenant-retention-${tenantId}`).click();

    const sheet = page.getByTestId('retention-sheet');
    await expect(sheet).toBeVisible();

    const firstSwitch = sheet.getByRole('switch').first();
    const isChecked = await firstSwitch.getAttribute('aria-checked');
    if (isChecked !== 'true') {
      await firstSwitch.click();
    }

    const numberInput = sheet.locator('input[type="number"]').first();
    await expect(numberInput).toBeVisible();
    await numberInput.fill('90');

    await page.getByTestId('retention-save').click();

    await expect(page.getByTestId('retention-sheet')).not.toBeVisible();

    const policy = await api.getRetentionPolicy(tenantId);
    expect(policy.conversationRetentionDays).toBe(90);

    await api.updateRetentionPolicy(tenantId, {
      conversationRetentionDays: null,
      authEventRetentionDays: null,
      auditRetentionDays: null,
      usageRecordRetentionDays: null,
    });
    await api.deleteTenant(tenantId);
  });

  test('should navigate to GDPR via sidebar', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/tenants');

    await page.getByTestId('sidebar-group-compliance').click();
    await page.getByTestId('sidebar-link-gdpr').click();

    await expect(page).toHaveURL(/\/admin\/gdpr/);
  });
});
