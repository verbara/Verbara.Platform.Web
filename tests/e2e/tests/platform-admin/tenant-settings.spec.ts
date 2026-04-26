import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

// Skip the entire spec when the full backend stack is not running; it relies
// on the live `/api/v1/management/tenants/{id}/settings` endpoint plus a
// platform-admin authenticated session. Tracked under the R5.3 Phase B Task
// B.1 (Tenant Settings editor greenfield) plan.
test.describe('Tenant Settings editor', () => {
  test.skip(
    process.env.E2E_FULL_STACK !== 'true',
    'Requires backend stack: set E2E_FULL_STACK=true to enable.',
  );

  test('should edit tenant operational settings and persist', async ({
    platformAdminPage: page,
    authenticatedApiContext,
  }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const tenantId = `e2e-settings-${Date.now()}`;
    await api.createTenant({ tenantId, name: 'Settings Test Tenant' });

    await page.goto(`/admin/tenants/${tenantId}/settings`);
    await expect(page.getByTestId('tenant-detail-page')).toBeVisible();

    // Default tab is General. Switch to Operational/General settings form.
    await page.getByTestId('tab-operational').click();

    const channels = page.getByTestId('field-maxConcurrentChannels');
    await channels.fill('77');
    await page.getByTestId('tenant-settings-submit').click();

    // Toast confirms persistence.
    await expect(page.getByText(/saved|updated/i).first()).toBeVisible();

    // Reload to confirm round-trip.
    await page.reload();
    await page.getByTestId('tab-operational').click();
    await expect(page.getByTestId('field-maxConcurrentChannels')).toHaveValue('77');

    await api.deleteTenant(tenantId);
  });
});
