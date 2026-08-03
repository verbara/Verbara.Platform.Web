import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Auth Config', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/auth-config');
  });

  test('should display MFA policy section', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-config-mfa-optional')).toBeVisible();
    await expect(page.getByTestId('auth-config-mfa-required_for_roles')).toBeVisible();
    await expect(page.getByTestId('auth-config-mfa-required_all')).toBeVisible();
  });

  test('should change and save MFA policy', async ({
    platformAdminPage: page,
    authenticatedApiContext,
  }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const original = await api.getAuthConfig();

    // The restore MUST run even when an assertion fails. It used to be the last statement of the
    // body, so a failure above left the platform tenant on required_all — and since the fixture user
    // is not MFA-enrolled, every later spec in the run then died at login. One assertion took 243
    // tests down with it.
    try {
      await page.getByTestId('auth-config-mfa-required_all').click();
      await page.getByTestId('auth-config-save').click();

      // Persistence is asserted through the API, not through a page reload: required_all locks THIS
      // account out of a reload, because /auth/refresh re-evaluates MFA policy and the fixture user
      // has no TOTP enrolled. The old reload-then-assert only worked while the browser kept a
      // credential across reloads; it no longer does, and a reload here now lands on /login.
      await expect
        .poll(async () => (await api.getAuthConfig()).mfaPolicy, { timeout: 5000 })
        .toBe('required_all');
    } finally {
      await api.updateAuthConfig(original);
    }
  });

  test('should display password policy', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-config-passwordMinLength')).toBeVisible();
    await expect(page.getByTestId('auth-config-passwordUppercase')).toBeVisible();
    await expect(page.getByTestId('auth-config-passwordNumber')).toBeVisible();
    await expect(page.getByTestId('auth-config-passwordSpecial')).toBeVisible();
  });

  test('should change and save password min length', async ({
    platformAdminPage: page,
    authenticatedApiContext,
  }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const original = await api.getAuthConfig();

    // Same fault-tolerance rule as the MFA test above: a tenant-wide setting must be restored even
    // when the assertion fails, or it leaks into every spec that runs afterwards.
    try {
      const minLength = page.getByTestId('auth-config-passwordMinLength');
      await minLength.clear();
      await minLength.fill('16');
      await page.getByTestId('auth-config-save').click();

      await page.reload();
      await expect(page.getByTestId('auth-config-passwordMinLength')).toHaveValue('16');
    } finally {
      await api.updateAuthConfig(original);
    }
  });

  test('should display lockout policy', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-config-lockoutThreshold')).toBeVisible();
    await expect(page.getByTestId('auth-config-lockoutDuration')).toBeVisible();
  });

  test('should display session timeouts', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-config-sessionIdle')).toBeVisible();
    await expect(page.getByTestId('auth-config-sessionAbsolute')).toBeVisible();
  });

  test('should toggle OIDC and show fields', async ({ platformAdminPage: page }) => {
    const toggle = page.getByTestId('auth-config-oidcEnabled');
    await toggle.click();

    await expect(page.getByTestId('auth-config-oidcAuthority')).toBeVisible();
    await expect(page.getByTestId('auth-config-oidcClientId')).toBeVisible();
    await expect(page.getByTestId('auth-config-oidcClientSecret')).toBeVisible();

    await toggle.click();
  });

  test('should disable save button when no changes', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-config-save')).toBeDisabled();
  });
});
