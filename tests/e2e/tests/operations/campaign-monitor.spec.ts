import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Campaign Monitor', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/operations/campaigns');
  });

  test('should display campaign monitor page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('campaign-monitor-page')).toBeVisible();
  });

  test('should show filter buttons', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('campaign-monitor-filters')).toBeVisible();
    await expect(page.getByTestId('campaign-monitor-filter-all')).toBeVisible();
    await expect(page.getByTestId('campaign-monitor-filter-active')).toBeVisible();
    await expect(page.getByTestId('campaign-monitor-filter-paused')).toBeVisible();
  });

  test('should have "All" filter active by default', async ({ demoAdminPage: page }) => {
    const allButton = page.getByTestId('campaign-monitor-filter-all');
    await expect(allButton).toBeVisible();
    // The active filter uses variant="default" (solid), inactive uses variant="outline"
    // Default variant will NOT have the outline class patterns
    await expect(allButton).not.toHaveClass(/border-input/);
  });

  test('should show campaign cards section', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('campaign-monitor-cards')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/operations/wallboard');
    await page.getByTestId('sidebar-link-campaigns').click();
    await expect(page).toHaveURL(/\/operations\/campaigns/);
    await expect(page.getByTestId('campaign-monitor-page')).toBeVisible();
  });
});
