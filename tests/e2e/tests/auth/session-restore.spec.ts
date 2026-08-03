import { test, expect, AUTH_PERSIST_KEY } from '../../fixtures/auth.fixture';

/**
 * Regression fence for the "credentials are never persisted" rule.
 *
 * The app keeps its durable credential in an httpOnly refresh cookie and mints an access token at
 * runtime; nothing bearer-shaped may reach browser storage. These specs assert that from the
 * outside, the way an attacker would look at it.
 */
test.describe('auth session storage', () => {
  test('fixture-authenticated page renders a guarded route', async ({
    platformAdminPage: page,
  }) => {
    // Proves the fixture actually authenticates. Without this, a fixture that silently stopped
    // establishing a session would let every other spec fail for the wrong reason — or worse, pass
    // against a login page that happens to contain the asserted markup.
    await page.goto('/admin');

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('no credential is written to session storage', async ({ platformAdminPage: page }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();

    const persisted = await page.evaluate((key) => sessionStorage.getItem(key), AUTH_PERSIST_KEY);

    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted as string) as { state: Record<string, unknown> };

    // The session identity is there...
    expect(parsed.state).toHaveProperty('user');
    expect(parsed.state).toHaveProperty('tenantId');
    // ...but none of the credentials.
    expect(parsed.state).not.toHaveProperty('accessToken');
    expect(parsed.state).not.toHaveProperty('tokenExpiry');
    expect(parsed.state).not.toHaveProperty('mfaPending');
    expect(parsed.state).not.toHaveProperty('impersonation');

    // Nothing JWT-shaped anywhere in ANY storage entry, whatever the key.
    const allStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
    expect(allStorage).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  test('reload restores the session without bouncing to login', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();

    // The reload drops the in-memory token; the app must re-mint it from the refresh cookie.
    const refreshCall = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/refresh') && response.request().method() === 'POST',
    );
    await page.reload();
    await refreshCall;

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
