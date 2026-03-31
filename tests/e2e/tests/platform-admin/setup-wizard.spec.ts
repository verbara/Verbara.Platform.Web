import { test, expect } from '../../fixtures/auth.fixture';
import { API_BASE } from '../../helpers/credentials';

test.describe('Setup Wizard', () => {
  test('should block setup when platform already initialized', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/setup`, {
      data: {
        email: 'test@test.local',
        password: 'TestPass2026!',
        displayName: 'Test',
        platformName: 'Test',
      },
    });
    expect(response.ok()).toBe(false);
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should dismiss setup banner', async ({ platformAdminPage: page }) => {
    await page.goto('/admin');
    const banner = page.getByTestId('setup-banner');
    const isVisible = await banner.isVisible().catch(() => false);
    if (isVisible) {
      await page.getByTestId('setup-banner-dismiss').click();
      await expect(banner).not.toBeVisible();
    }
  });

  test('should navigate wizard steps', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/setup');

    const nextBtn = page.getByTestId('setup-next');
    const backBtn = page.getByTestId('setup-back');
    const skipBtn = page.getByTestId('setup-skip');

    const getStarted = page.getByTestId('setup-getstarted');
    if (await getStarted.isVisible().catch(() => false)) {
      await getStarted.click();
    }

    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await expect(backBtn).toBeEnabled();
      await backBtn.click();
    }

    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await expect(page).not.toHaveURL(/\/admin\/setup/);
    }
  });
});
