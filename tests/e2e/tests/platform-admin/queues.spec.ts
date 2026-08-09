import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Queues', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/queues');
  });

  test('should display queues page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('queues-page')).toBeVisible();
    await expect(page.getByTestId('queues-create-btn')).toBeVisible();
  });

  test('should show queues in data table', async ({ demoAdminPage: page, demoApiContext }) => {
    // The table only renders once there is at least one row, and the Customer tenant starts
    // empty ("No queues yet"). Seeding here keeps the test independent of demo-seed state
    // instead of asserting against data some other spec happened to leave behind.
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const res = await api.createQueue({ name: `E2E Table Queue ${Date.now()}` });
    const created = await res.json();

    await page.reload();
    await expect(page.getByTestId('data-table')).toBeVisible();

    await api.deleteQueue(created.id);
  });

  test('should create a queue', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Queue ${Date.now()}`;

    await page.getByTestId('queues-create-btn').click();
    await page.getByTestId('queue-form-name').fill(name);
    await page.getByTestId('queue-form-submit').click();

    // The list is paginated (10 per page) and ordered by createdAt ascending,
    // so the newly-created row may land on a later page. Filter by name via
    // the search input to make the assertion deterministic regardless of how
    // much leftover data exists from prior runs.
    await page.getByTestId('data-table-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    const queues = await api.listQueues();
    const created = queues.find((q: any) => q.name === name);
    if (created) await api.deleteQueue(created.id);
  });

  test('should search queues', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Search Queue ${Date.now()}`;

    await api.createQueue({ name });
    await page.reload();

    await page.getByTestId('data-table-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    const queues = await api.listQueues();
    const created = queues.find((q: any) => q.name === name);
    if (created) await api.deleteQueue(created.id);
  });

  test('should navigate to queue detail', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Detail Queue ${Date.now()}`;

    const res = await api.createQueue({ name });
    const created = await res.json();

    await page.reload();

    // Filter to the specific queue — with leftover data from prior runs,
    // the row may not be on page 1.
    await page.getByTestId('data-table-search').fill(name);
    await page.getByText(name).click();
    await expect(page).toHaveURL(/\/admin\/queues\//);

    await api.deleteQueue(created.id);
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-queues').click();
    await expect(page).toHaveURL(/\/admin\/queues/);
  });
});
