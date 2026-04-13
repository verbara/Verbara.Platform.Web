import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Agent States', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/operations/agents');
  });

  test('should display agent states page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('agent-states-page')).toBeVisible();
  });

  test('should show agent states table', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('agent-states-table')).toBeVisible();
  });

  test('should display page header with title', async ({ platformAdminPage: page }) => {
    await expect(
      page.getByTestId('agent-states-page').getByRole('heading', { name: /estados de agentes/i }),
    ).toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/operations/wallboard');
    await page.getByRole('link', { name: /estados de agentes/i }).click();
    await expect(page).toHaveURL(/\/operations\/agents/);
    await expect(page.getByTestId('agent-states-page')).toBeVisible();
  });
});
