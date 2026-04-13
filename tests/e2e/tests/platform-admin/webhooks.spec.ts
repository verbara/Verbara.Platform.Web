import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Webhooks', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/webhooks');
  });

  test('should display webhooks page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('webhooks-page')).toBeVisible();
    await expect(page.getByTestId('webhooks-create-btn')).toBeVisible();
  });

  test('should create a webhook subscription', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Webhook ${Date.now()}`;

    await page.getByTestId('webhooks-create-btn').click();
    await page.getByTestId('webhook-form-name').fill(name);
    await page.getByTestId('webhook-form-url').fill('https://example.com/e2e-hook');

    const firstCheckbox = page.locator('[role="checkbox"]').first();
    await firstCheckbox.waitFor();
    await firstCheckbox.click();

    await page.getByTestId('webhook-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const subscriptions = await api.listWebhookSubscriptions();
    const created = subscriptions.find((s: any) => s.name === name);
    if (created) await api.deleteWebhookSubscription(created.subscriptionId);
  });

  test('should show validation for HTTP URL', async ({ platformAdminPage: page }) => {
    await page.getByTestId('webhooks-create-btn').click();
    await page.getByTestId('webhook-form-name').fill('Validation Test');
    await page.getByTestId('webhook-form-url').fill('http://insecure.com');

    const firstCheckbox = page.locator('[role="checkbox"]').first();
    await firstCheckbox.waitFor();
    await firstCheckbox.click();

    await page.getByTestId('webhook-form-submit').click();

    await expect(page.getByTestId('webhook-form-name')).toBeVisible();
    await expect(page.getByTestId('webhook-form-url-error')).toContainText(/https/i);
  });

  test('should show one-time secret dialog after creation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Secret ${Date.now()}`;

    await page.getByTestId('webhooks-create-btn').click();
    await page.getByTestId('webhook-form-name').fill(name);
    await page.getByTestId('webhook-form-url').fill('https://example.com/e2e-hook');

    const firstCheckbox = page.locator('[role="checkbox"]').first();
    await firstCheckbox.waitFor();
    await firstCheckbox.click();

    await page.getByTestId('webhook-form-submit').click();

    await expect(page.getByText(/secret/i)).toBeVisible();

    const subscriptions = await api.listWebhookSubscriptions();
    const created = subscriptions.find((s: any) => s.name === name);
    if (created) await api.deleteWebhookSubscription(created.subscriptionId);
  });

  test('should edit a webhook subscription', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Edit ${Date.now()}`;

    const res = await api.createWebhookSubscription({
      name,
      endpointUrl: 'https://example.com/e2e-hook',
      eventTypes: ['conversation.assigned'],
    });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`edit-webhook-${created.subscriptionId}`).click();
    await page.getByTestId('webhook-form-name').clear();
    await page.getByTestId('webhook-form-name').fill(`${name} Edited`);
    await page.getByTestId('webhook-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(`${name} Edited`)).toBeVisible();

    await api.deleteWebhookSubscription(created.subscriptionId);
  });

  test('should delete a webhook with confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Delete ${Date.now()}`;

    const res = await api.createWebhookSubscription({
      name,
      endpointUrl: 'https://example.com/e2e-hook',
      eventTypes: ['conversation.assigned'],
    });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`delete-webhook-${created.subscriptionId}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should open detail sheet', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Detail ${Date.now()}`;

    const res = await api.createWebhookSubscription({
      name,
      endpointUrl: 'https://example.com/e2e-hook',
      eventTypes: ['conversation.assigned'],
    });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`detail-webhook-${created.subscriptionId}`).click();

    await expect(page.getByTestId('webhook-detail-sheet')).toBeVisible();

    await api.deleteWebhookSubscription(created.subscriptionId);
  });

  test('should send test webhook', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Send Test ${Date.now()}`;

    const res = await api.createWebhookSubscription({
      name,
      endpointUrl: 'https://example.com/e2e-hook',
      eventTypes: ['conversation.assigned'],
    });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`detail-webhook-${created.subscriptionId}`).click();
    await expect(page.getByTestId('webhook-detail-sheet')).toBeVisible();

    await page.getByTestId('webhook-send-test').click();
    await page.waitForTimeout(600);

    await expect(page.getByTestId('webhook-send-test')).not.toBeDisabled();

    await api.deleteWebhookSubscription(created.subscriptionId);
  });

  test('should rotate webhook secret', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Rotate ${Date.now()}`;

    const res = await api.createWebhookSubscription({
      name,
      endpointUrl: 'https://example.com/e2e-hook',
      eventTypes: ['conversation.assigned'],
    });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`detail-webhook-${created.subscriptionId}`).click();
    await expect(page.getByTestId('webhook-detail-sheet')).toBeVisible();

    await page.getByTestId('webhook-rotate-secret').click();
    await page.waitForTimeout(600);

    await expect(page.getByTestId('webhook-rotate-secret')).not.toBeDisabled();

    await api.deleteWebhookSubscription(created.subscriptionId);
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');

    await page.getByTestId('sidebar-group-integrations').click();
    await page.getByTestId('sidebar-link-webhooks').click();

    await expect(page).toHaveURL(/\/admin\/webhooks/);
  });
});
