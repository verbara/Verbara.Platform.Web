import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Agent Intervals', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/agent-intervals');
  });

  test('should display agent intervals page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('agent-intervals-page')).toBeVisible();
  });

  test('should show agent intervals table', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('agent-intervals-table')).toBeVisible();
  });

  test('should display page header', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('page-header')).toBeVisible();
    await expect(page.getByTestId('page-header-title')).toHaveText('Agent Intervals');
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByTestId('sidebar-link-agent-intervals').click();
    await expect(page).toHaveURL(/\/analytics\/agent-intervals/);
    await expect(page.getByTestId('agent-intervals-page')).toBeVisible();
  });
});
