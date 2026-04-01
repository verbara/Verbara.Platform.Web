import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

const TENANT_ID = 'platform';

test.describe('Billing — Rate Cards', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/billing/rate-cards');
  });

  test('should display rate cards page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('rate-cards-page')).toBeVisible();
    await expect(page.getByTestId('create-rate-card')).toBeVisible();
  });

  test('should show data table', async ({ platformAdminPage: page }) => {
    const table = page.getByTestId('data-table');
    await expect(table).toBeVisible();
  });

  test('should create a rate card via UI', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Rate Card ${Date.now()}`;

    await page.getByTestId('create-rate-card').click();
    await page.getByTestId('rate-card-name').fill(name);
    await page.getByTestId('rate-card-currency').clear();
    await page.getByTestId('rate-card-currency').fill('EUR');
    await page.getByTestId('rate-card-from').fill('2026-01-01T00:00');

    await page.getByTestId('add-rate-entry').click();
    await expect(page.getByTestId('rate-entry-0')).toBeVisible();

    await page.getByTestId('rate-card-submit').click();

    await expect(page.getByText(name)).toBeVisible();

    const cards = await api.listRateCards(TENANT_ID);
    const created = cards.find((c: any) => c.name === name);
    if (created) await api.deleteRateCard(TENANT_ID, created.rateCardId);
  });

  test('should edit an existing rate card', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Edit RC ${Date.now()}`;

    await api.createRateCard(TENANT_ID, {
      name,
      currency: 'USD',
      effectiveFrom: '2026-01-01T00:00:00Z',
      isDefault: false,
      rates: [{ usageType: 'VoiceInbound', unitPrice: 0.01, includedQuantity: 100, tiers: null }],
    });
    await page.reload();

    const cards = await api.listRateCards(TENANT_ID);
    const card = cards.find((c: any) => c.name === name);
    await page.getByTestId(`edit-rate-card-${card.rateCardId}`).click();

    await page.getByTestId('rate-card-name').clear();
    await page.getByTestId('rate-card-name').fill(`${name} Edited`);
    await page.getByTestId('rate-card-submit').click();

    await expect(page.getByText(`${name} Edited`)).toBeVisible();

    await api.deleteRateCard(TENANT_ID, card.rateCardId);
  });

  test('should delete a rate card with 3s confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Delete RC ${Date.now()}`;

    await api.createRateCard(TENANT_ID, {
      name,
      currency: 'USD',
      effectiveFrom: '2026-01-01T00:00:00Z',
      isDefault: false,
      rates: [{ usageType: 'VoiceInbound', unitPrice: 0.01, includedQuantity: 0, tiers: null }],
    });
    await page.reload();

    const cards = await api.listRateCards(TENANT_ID);
    const card = cards.find((c: any) => c.name === name);
    await page.getByTestId(`delete-rate-card-${card.rateCardId}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should search rate cards', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Search RC ${Date.now()}`;

    await api.createRateCard(TENANT_ID, {
      name,
      currency: 'USD',
      effectiveFrom: '2026-01-01T00:00:00Z',
      isDefault: false,
      rates: [{ usageType: 'SmsOutbound', unitPrice: 0.005, includedQuantity: 0, tiers: null }],
    });
    await page.reload();

    await page.getByTestId('data-table-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    const cards = await api.listRateCards(TENANT_ID);
    const card = cards.find((c: any) => c.name === name);
    if (card) await api.deleteRateCard(TENANT_ID, card.rateCardId);
  });

  test('should display rate entry count in table', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Entries RC ${Date.now()}`;

    await api.createRateCard(TENANT_ID, {
      name,
      currency: 'USD',
      effectiveFrom: '2026-01-01T00:00:00Z',
      isDefault: false,
      rates: [
        { usageType: 'VoiceInbound', unitPrice: 0.01, includedQuantity: 100, tiers: null },
        { usageType: 'SmsOutbound', unitPrice: 0.005, includedQuantity: 50, tiers: null },
      ],
    });
    await page.reload();

    await expect(page.getByText('2 entries')).toBeVisible();

    const cards = await api.listRateCards(TENANT_ID);
    const card = cards.find((c: any) => c.name === name);
    if (card) await api.deleteRateCard(TENANT_ID, card.rateCardId);
  });
});
