import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Monitor', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/operations/monitor');
  });

  test('should display monitor page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('monitor-page')).toBeVisible();
  });

  test('should show sessions list panel', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('monitor-sessions-list')).toBeVisible();
  });

  test('should show empty state when no active sessions', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('monitor-empty-state')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/operations/wallboard');
    await page.getByRole('link', { name: /^monitor$/i }).click();
    await expect(page).toHaveURL(/\/operations\/monitor/);
    await expect(page.getByTestId('monitor-page')).toBeVisible();
  });
});
