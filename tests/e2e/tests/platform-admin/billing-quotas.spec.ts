import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

const TENANT_ID = 'platform';

test.describe('Billing — Quotas', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/billing/quotas');
  });

  test('should display quotas page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('quotas-page')).toBeVisible();
  });

  test('should show edit button', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('edit-quota')).toBeVisible();
  });

  test('should show quota limits after seeding', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    await api.updateQuota(TENANT_ID, {
      maxConcurrentChannels: 200,
      maxActiveCampaigns: 20,
      quotaAction: 'Warn',
    });
    await page.reload();

    await expect(page.getByTestId('quota-limits')).toBeVisible();
    await expect(page.getByTestId('quota-action-badge')).toBeVisible();
    await expect(page.getByTestId('quota-action-badge')).toContainText('Warn');
  });

  test('should open edit sheet and show form fields', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    await api.updateQuota(TENANT_ID, {
      maxConcurrentChannels: 100,
      maxActiveCampaigns: 10,
      quotaAction: 'Warn',
    });
    await page.reload();

    await page.getByTestId('edit-quota').click();
    await expect(page.getByTestId('quota-channels')).toBeVisible();
    await expect(page.getByTestId('quota-campaigns')).toBeVisible();
    await expect(page.getByTestId('quota-voice')).toBeVisible();
    await expect(page.getByTestId('quota-messages')).toBeVisible();
    await expect(page.getByTestId('quota-storage')).toBeVisible();
    await expect(page.getByTestId('quota-agents')).toBeVisible();
    await expect(page.getByTestId('quota-action-select')).toBeVisible();
    await expect(page.getByTestId('quota-submit')).toBeVisible();
  });

  test('should update quota via form', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    await api.updateQuota(TENANT_ID, {
      maxConcurrentChannels: 100,
      maxActiveCampaigns: 10,
      quotaAction: 'Warn',
    });
    await page.reload();

    await page.getByTestId('edit-quota').click();
    await page.getByTestId('quota-channels').clear();
    await page.getByTestId('quota-channels').fill('500');
    await page.getByTestId('quota-submit').click();

    const status = await api.getQuotaStatus(TENANT_ID);
    expect(status.quota.maxConcurrentChannels).toBe(500);

    await api.updateQuota(TENANT_ID, { maxConcurrentChannels: 100 });
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/billing/rate-cards');
    await page.getByTestId('sidebar-link-quotas').click();
    await expect(page).toHaveURL(/\/admin\/billing\/quotas/);
    await expect(page.getByTestId('quotas-page')).toBeVisible();
  });
});
