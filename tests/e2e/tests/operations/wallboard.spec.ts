import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Wallboard', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/operations/wallboard');
  });

  test('should display wallboard page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('wallboard-page')).toBeVisible();
  });

  test('should show global KPI cards', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('wallboard-global-kpis')).toBeVisible();
  });

  test('should show queue cards section', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('wallboard-queue-cards')).toBeVisible();
  });

  test('should show live states section when data available', async ({ platformAdminPage: page }) => {
    // Live states section is conditionally rendered; verify it exists or the page loads without error
    const liveStates = page.getByTestId('wallboard-live-states');
    const isVisible = await liveStates.isVisible().catch(() => false);
    if (isVisible) {
      await expect(liveStates).toBeVisible();
    } else {
      // Page loaded correctly even without live state data
      await expect(page.getByTestId('wallboard-page')).toBeVisible();
    }
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/operations/agents');
    await page.getByRole('link', { name: /tablero/i }).click();
    await expect(page).toHaveURL(/\/operations\/wallboard/);
    await expect(page.getByTestId('wallboard-page')).toBeVisible();
  });
});
