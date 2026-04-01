import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Queues', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/queues');
  });

  test('should display queues page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('queues-page')).toBeVisible();
    await expect(page.getByTestId('queues-create-btn')).toBeVisible();
  });

  test('should show queues in data table', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('data-table')).toBeVisible();
  });

  test('should create a queue', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Queue ${Date.now()}`;

    await page.getByTestId('queues-create-btn').click();
    await page.getByTestId('queue-form-name').fill(name);
    await page.getByTestId('queue-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const queues = await api.listQueues();
    const created = queues.find((q: any) => q.name === name);
    if (created) await api.deleteQueue(created.queueId);
  });

  test('should search queues', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Search Queue ${Date.now()}`;

    await api.createQueue({ name });
    await page.reload();

    await page.getByTestId('data-table-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    const queues = await api.listQueues();
    const created = queues.find((q: any) => q.name === name);
    if (created) await api.deleteQueue(created.queueId);
  });

  test('should navigate to queue detail', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Detail Queue ${Date.now()}`;

    const res = await api.createQueue({ name });
    const created = await res.json();

    await page.reload();

    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/admin\/queues\//);

    await api.deleteQueue(created.queueId);
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-queues').click();
    await expect(page).toHaveURL(/\/admin\/queues/);
  });
});
