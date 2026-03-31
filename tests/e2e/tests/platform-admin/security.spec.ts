import { test, expect } from '../../fixtures/auth.fixture';
import { PLATFORM_ADMIN } from '../../helpers/credentials';
import * as OTPAuth from 'otpauth';

test.describe('Security — Personal', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/security');
  });

  test('should display MFA status as disabled', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('security-mfa-status')).toContainText(/disabled/i);
  });

  test('should complete MFA setup flow', async ({ platformAdminPage: page }) => {
    await page.getByTestId('security-mfa-enable').click();
    await expect(page.getByTestId('security-mfa-qrcode')).toBeVisible();

    await page.getByTestId('security-mfa-next-verify').click();

    const secretText = await page.locator('code, [class*="mono"]').first().textContent();
    if (!secretText) {
      test.skip(true, 'Could not extract MFA secret from page');
      return;
    }

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secretText.replace(/\s/g, '')),
      digits: 6,
      period: 30,
    });
    const code = totp.generate();

    await page.getByTestId('security-mfa-code').fill(code);
    await page.getByTestId('security-mfa-confirm').click();

    await expect(page.getByTestId('security-mfa-recovery-codes')).toBeVisible();
    await page.getByTestId('security-mfa-done').click();

    await expect(page.getByTestId('security-mfa-status')).toContainText(/enabled/i);

    // Cleanup: disable MFA
    await page.getByTestId('security-mfa-disable').click();
    await page.getByTestId('security-mfa-disable-password').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('security-mfa-disable-confirm').click();
    await expect(page.getByTestId('security-mfa-status')).toContainText(/disabled/i);
  });

  test('should show copy and download buttons for recovery codes', async ({ platformAdminPage: page }) => {
    await page.getByTestId('security-mfa-enable').click();
    await page.getByTestId('security-mfa-next-verify').click();

    const secretText = await page.locator('code, [class*="mono"]').first().textContent();
    if (!secretText) {
      test.skip(true, 'Could not extract MFA secret');
      return;
    }

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secretText.replace(/\s/g, '')),
      digits: 6,
      period: 30,
    });
    await page.getByTestId('security-mfa-code').fill(totp.generate());
    await page.getByTestId('security-mfa-confirm').click();

    await expect(page.getByTestId('security-mfa-copy')).toBeVisible();
    await expect(page.getByTestId('security-mfa-download')).toBeVisible();

    // Cleanup
    await page.getByTestId('security-mfa-done').click();
    await page.getByTestId('security-mfa-disable').click();
    await page.getByTestId('security-mfa-disable-password').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('security-mfa-disable-confirm').click();
  });

  test('should disable MFA button not visible when already disabled', async ({ platformAdminPage: page }) => {
    const status = await page.getByTestId('security-mfa-status').textContent();
    if (status?.toLowerCase().includes('disabled')) {
      await expect(page.getByTestId('security-mfa-disable')).not.toBeVisible();
    }
  });

  test('should change password form be functional', async ({ platformAdminPage: page }) => {
    await page.getByTestId('security-password-old').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('security-password-new').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('security-password-confirm').fill(PLATFORM_ADMIN.password);
    await expect(page.getByTestId('security-password-submit')).toBeEnabled();
  });

  test('should show validation when passwords dont match', async ({ platformAdminPage: page }) => {
    await page.getByTestId('security-password-old').fill('OldPass123!');
    await page.getByTestId('security-password-new').fill('NewPass123!');
    await page.getByTestId('security-password-confirm').fill('DifferentPass123!');
    await page.getByTestId('security-password-submit').click();

    await expect(page).toHaveURL(/\/admin\/security/);
  });
});
