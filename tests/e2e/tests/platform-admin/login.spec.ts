import { test, expect, type Page } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { PLATFORM_ADMIN, DEMO_ADMIN } from '../../helpers/credentials';

/**
 * Signs in through the form, always supplying the tenant.
 *
 * The API rejects a login without one (`400 Tenant identification required`) unless the host
 * resolves a tenant by subdomain, which `localhost` does not — so the tenant toggle has to be
 * opened and filled even for the demo tenant.
 */
async function loginAs(page: Page, creds: { tenantId: string; email: string; password: string }) {
  await page.getByTestId('login-tenant-toggle').click();
  await page.getByTestId('login-tenant').fill(creds.tenantId);
  await page.getByTestId('login-email').fill(creds.email);
  await page.getByTestId('login-password').fill(creds.password);
  await page.getByTestId('login-submit').click();
}

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login successfully as platform admin', async ({ page }) => {
    await loginAs(page, PLATFORM_ADMIN);

    await expect(page).not.toHaveURL(/\/login/);
    // The shell renders the identity as initials in an avatar, never the raw email, so the menu
    // trigger is the assertable signal that an authenticated shell mounted.
    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
  });

  test('should login successfully as demo admin', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);

    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should show error on wrong password', async ({ page }) => {
    await page.getByTestId('login-email').fill(DEMO_ADMIN.email);
    await page.getByTestId('login-password').fill('WrongPassword123!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error on nonexistent email', async ({ page }) => {
    await page.getByTestId('login-email').fill('nobody@nowhere.local');
    await page.getByTestId('login-password').fill('SomePassword123!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show validation on empty fields', async ({ page }) => {
    // Submit button stays disabled until email + password are filled.
    await expect(page.getByTestId('login-submit')).toBeDisabled();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout and redirect to login', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await expect(page).not.toHaveURL(/\/login/);

    await page.getByTestId('user-menu-trigger').click();
    await page.getByTestId('user-menu-logout').click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/admin/tenants');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect protected route to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin/tenants');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should persist session after page reload', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await expect(page).not.toHaveURL(/\/login/);

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
  });
});

authTest.describe('Login - MFA recovery code', () => {
  authTest(
    'should accept recovery code instead of TOTP during MFA verify',
    async ({ page, authenticatedApiContext }) => {
      const api = new ApiHelper(authenticatedApiContext);
      const email = `mfa-recovery-${Date.now()}@test.local`;
      const password = 'TestPassword123!';

      const { recoveryCodes } = await api.setupTestUserWithMfa(email, password);
      const [firstCode] = recoveryCodes;
      if (!firstCode) {
        throw new Error('setupTestUserWithMfa returned no recovery codes');
      }

      await page.goto('/login');

      // Tenant toggle is collapsed by default on the demo build — open it so
      // the test user (created in the platform admin tenant) can authenticate.
      await page.getByTestId('login-tenant-toggle').click();
      await page.getByTestId('login-tenant').fill(PLATFORM_ADMIN.tenantId);
      await page.getByTestId('login-email').fill(email);
      await page.getByTestId('login-password').fill(password);
      await page.getByTestId('login-submit').click();

      // MFA challenge should appear
      await expect(page.getByTestId('login-mfa-section')).toBeVisible();

      // Toggle to recovery code mode and submit the first recovery code
      await page.getByTestId('login-mfa-use-recovery').click();
      await page.getByTestId('login-mfa-recovery-input').fill(firstCode);
      await page.getByTestId('login-mfa-submit').click();

      // Successful verification should redirect to an authenticated app area
      await expect(page).toHaveURL(/\/admin|\/agent|\/operations|\/analytics/);
    },
  );
});
