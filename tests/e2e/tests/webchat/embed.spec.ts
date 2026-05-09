import { test, expect } from '../../fixtures/auth.fixture';

test.describe('WebChat widget — demo page', () => {
  test('Loads_Demo_AndOpensIframe_OnBubbleClick', async ({ page }) => {
    await page.goto('/webchat/demo.html');
    await expect(page.locator('h1')).toContainText('WebChat');

    const bubbleHost = page.locator('[data-verbara-webchat-bubble]');
    await expect(bubbleHost).toBeVisible({ timeout: 5_000 });

    await bubbleHost.click();

    const iframe = page.locator('iframe[data-verbara-webchat-iframe]');
    await expect(iframe).toBeVisible({ timeout: 5_000 });
  });
});
