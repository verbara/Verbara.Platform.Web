import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Agent States', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/operations/agents');
  });

  test('should display agent states page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('agent-states-page')).toBeVisible();
  });

  test('should show agent states table', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('agent-states-table')).toBeVisible();
  });

  test('should display page header with title', async ({ demoAdminPage: page }) => {
    // Matching the heading by its Spanish name only passes when the app happens to render in
    // es-419; the title is translated, the testid is not.
    await expect(
      page.getByTestId('agent-states-page').getByTestId('page-header-title'),
    ).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/operations/wallboard');
    await page.getByTestId('sidebar-link-agents').click();
    await expect(page).toHaveURL(/\/operations\/agents/);
    await expect(page.getByTestId('agent-states-page')).toBeVisible();
  });
});
