import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Auth Config', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/auth-config');
  });

  test('should display MFA policy section', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-config-mfa-optional')).toBeVisible();
    await expect(page.getByTestId('auth-config-mfa-required-roles')).toBeVisible();
    await expect(page.getByTestId('auth-config-mfa-required-all')).toBeVisible();
  });

  test('should change and save MFA policy', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const original = await api.getAuthConfig();

    await page.getByTestId('auth-config-mfa-required-all').click();
    await page.getByTestId('auth-config-save').click();

    await page.reload();
    await expect(page.getByTestId('auth-config-mfa-required-all')).toBeChecked();

    await api.updateAuthConfig(original);
  });

  test('should display password policy', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('auth-config-passwordMinLength')).toBeVisible();
    await expect(page.getByTestId('auth-config-passwordUppercase')).toBeVisible();
    await expect(page.getByTestId('auth-config-passwordNumber')).toBeVisible();
    await expect(page.getByTestId('auth-config-passwordSpecial')).toBeVisible();
  });

  test('should change and save password min length', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const original = await api.getAuthConfig();

    const minLength = page.getByTestId('auth-config-passwordMinLength');
    await minLength.clear();
    await minLength.fill('16');
    await page.getByTestId('auth-config-save').click();

    await page.reload();
    await expect(page.getByTestId('auth-config-passwordMinLength')).toHaveValue('16');

    await api.updateAuthConfig(original);
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
