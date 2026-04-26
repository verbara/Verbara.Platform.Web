import { test, expect } from '../../fixtures/auth.fixture';
import { PLATFORM_ADMIN } from '../../helpers/credentials';
import * as OTPAuth from 'otpauth';

/**
 * E2E coverage for the R5.2 PA.2 profile-scoped MFA wizard, sessions, and
 * recovery-codes regenerate pages.
 *
 * Gated behind `E2E_FULL_STACK=true` in CI because it requires:
 *   - A real Platform.Api running (TOTP secret persistence + verify)
 *   - A real Postgres for IUserStore + IRefreshTokenStore
 *
 * Locally, run with:
 *   E2E_FULL_STACK=true npx playwright test tests/e2e/tests/profile/mfa-enroll-flow.spec.ts
 */

const FULL_STACK = process.env.E2E_FULL_STACK === 'true';

test.describe('Profile — MFA enroll wizard (R5.2 PA.2)', () => {
  test.beforeEach(async () => {
    test.skip(!FULL_STACK, 'Requires E2E_FULL_STACK=true (real Platform.Api + Postgres)');
  });

  test('happy_path_enroll_then_revoke_session_then_regenerate_codes', async ({
    platformAdminPage: page,
  }) => {
    // ─── Step 1 — Enroll wizard ─────────────────────────────────────────
    await page.goto('/profile/security/mfa/enroll');
    await expect(page.getByTestId('mfa-enroll-wizard')).toBeVisible();
    await expect(page.getByTestId('mfa-enroll-qrcode')).toBeVisible({ timeout: 10_000 });

    const manualCode = await page.getByTestId('mfa-enroll-manual-code').textContent();
    expect(manualCode).toBeTruthy();

    await page.getByTestId('mfa-enroll-next-verify').click();
    await expect(page.getByTestId('mfa-enroll-verify-step')).toBeVisible();

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(manualCode!.replace(/\s/g, '')),
      digits: 6,
      period: 30,
    });
    await page.getByTestId('mfa-enroll-totp-input').fill(totp.generate());
    await page.getByTestId('mfa-enroll-verify-submit').click();

    await expect(page.getByTestId('mfa-enroll-recovery-codes')).toBeVisible();
    await page.getByTestId('mfa-enroll-ack').check();
    await page.getByTestId('mfa-enroll-done').click();

    // ─── Step 2 — Sessions page ────────────────────────────────────────
    await page.goto('/profile/security/sessions');
    await expect(page.getByTestId('user-sessions-page')).toBeVisible();
    // The wizard's session is "current" so revoke must be disabled on its row.
    const currentBadge = page.getByTestId('user-session-current-badge').first();
    await expect(currentBadge).toBeVisible();

    // ─── Step 3 — Regenerate codes ─────────────────────────────────────
    await page.goto('/profile/security/recovery-codes/regenerate');
    await expect(page.getByTestId('recovery-warning-step')).toBeVisible();
    await page.getByTestId('recovery-regenerate-totp-input').fill(totp.generate());
    await page.getByTestId('recovery-regenerate-submit').click();
    await expect(page.getByTestId('recovery-codes-step')).toBeVisible();
    await page.getByTestId('recovery-regenerate-ack').check();
    await page.getByTestId('recovery-regenerate-done').click();

    // ─── Cleanup — disable MFA via legacy security page ────────────────
    await page.goto('/admin/profile/security');
    await page.getByTestId('security-mfa-disable').click();
    await page.getByTestId('security-mfa-disable-password').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('security-mfa-disable-confirm').click();
    await expect(page.getByTestId('security-mfa-status')).toContainText(/disabled/i);
  });
});
