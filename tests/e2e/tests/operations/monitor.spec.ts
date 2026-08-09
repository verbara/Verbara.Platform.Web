import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Monitor', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/operations/monitor');
  });

  test('should display monitor page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('monitor-page')).toBeVisible();
  });

  test('should show sessions list panel', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('monitor-sessions-list')).toBeVisible();
  });

  test('should show empty state when no active sessions', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('monitor-empty-state')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/operations/wallboard');
    await page.getByTestId('sidebar-link-monitor').click();
    await expect(page).toHaveURL(/\/operations\/monitor/);
    await expect(page.getByTestId('monitor-page')).toBeVisible();
  });
});
