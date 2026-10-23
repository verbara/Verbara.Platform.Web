import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Campaigns', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/campaigns');
  });

  test('should display campaigns page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('campaigns-page')).toBeVisible();
    await expect(page.getByTestId('campaigns-create-btn')).toBeVisible();
  });

  test('should navigate to wizard on create', async ({ demoAdminPage: page }) => {
    await page.getByTestId('campaigns-create-btn').click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/new/);
  });

  // The wizard's queue select carries the queue's name, and Save Draft posts it as
  // `targetQueueName` with no `queueId` (dialer-places-calls-end-to-end, design D1 and D7). The
  // assertion is on the request, not the response, so a demo tenant without the dialer license
  // still proves the body.
  test('should post the chosen queue name as targetQueueName on Save Draft', async ({
    demoAdminPage: page,
  }) => {
    await page.getByTestId('campaigns-create-btn').click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/new/);

    const queue = page.getByTestId('campaign-wizard-queue');
    const queueOptions = queue.locator('option:not([value=""])');
    await expect.poll(() => queueOptions.count()).toBeGreaterThan(0);

    const pairs = await queueOptions.evaluateAll((options) =>
      options.map((o) => ({
        value: (o as HTMLOptionElement).value,
        queueName: o.getAttribute('data-queue-name'),
      })),
    );
    for (const pair of pairs) {
      expect(pair.value).toBe(pair.queueName);
    }
    const chosen = pairs[0]!.value;

    await page.getByTestId('campaign-wizard-name').fill(`E2E queue by name ${Date.now()}`);
    await queue.selectOption(chosen);

    await page.getByTestId('campaign-wizard-step-schedule').click();
    const startDate = page.getByTestId('campaign-wizard-start-date');
    await expect(startDate).toBeVisible();
    await startDate.fill(new Date().toISOString().slice(0, 10));

    const create = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/admin/campaigns',
    );
    await page.getByTestId('campaign-wizard-save-draft').click();
    const body = (await create).postDataJSON() as Record<string, unknown>;

    expect(body.targetQueueName).toBe(chosen);
    expect(body).not.toHaveProperty('queueId');
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-campaigns').click();
    await expect(page).toHaveURL(/\/admin\/campaigns/);
  });
});
