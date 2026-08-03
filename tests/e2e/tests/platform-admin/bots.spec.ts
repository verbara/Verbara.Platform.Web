import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Bots', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/bots');
  });

  test('should display bots page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('bots-page')).toBeVisible();
    await expect(page.getByTestId('bots-create-btn')).toBeVisible();
  });

  test('should create a bot', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Bot ${Date.now()}`;

    await page.getByTestId('bots-create-btn').click();
    await page.getByTestId('bot-form-name').fill(name);
    await page.getByTestId('bot-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const bots = await api.listBots();
    const arr = Array.isArray(bots) ? bots : bots.items || [];
    const created = arr.find((b: any) => b.name === name);
    if (created) await api.deleteBot(created.id);
  });

  test('should delete a bot with 3s confirmation', async ({
    demoAdminPage: page,
    demoApiContext,
  }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Bot Del ${Date.now()}`;

    const res = await api.createBot({ name, maxTurns: 5, isActive: false });
    const created = await res.json();

    await page.reload();
    await page.getByTestId(`delete-bot-${created.id}`).click();

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
    await page.getByTestId('sidebar-group-ai-automation').click();
    await page.getByTestId('sidebar-link-bots').click();
    await expect(page).toHaveURL(/\/admin\/bots/);
  });
});
