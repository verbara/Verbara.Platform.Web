import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

/**
 * The recovery pages say what happened and send the tenant they show (change
 * `the-console-account-and-session-surfaces-match-the-api`, H4 and H16, spec
 * `sign-in-refusal-feedback`).
 *
 * Requires the full lab stack (Platform >= v2.25.0 from `docker/docker-compose.full.yml`); the
 * console's assertions read `data-*` attributes only, so they hold in every locale.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- tests/auth/password-recovery.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

const FORGOT_PATH = '/api/v1/auth/forgot-password';
const RESET_PATH = '/api/v1/auth/reset-password';

/**
 * Each test is a page load and one API round trip; the suite default (30 s) is the budget for
 * neither a cold console bundle nor a cold API, so each sets an explicit one. A budget, never a
 * wait: every step is fenced on a request, a response or an attribute.
 */
const TEST_BUDGET = 60_000;

/** A password long and varied enough for the reset form to enable its submit button. */
const NEW_PASSWORD = 'E2e-Recovery-Pass-1!';

test.describe('Password recovery (full stack)', () => {
  test.skip(!SHOULD_RUN, 'requires E2E_FULL_STACK=true and docker-compose.full.yml');

  test('the forgot-password page shows the tenant typed on the login page and sends it', async ({
    page,
  }) => {
    test.setTimeout(TEST_BUDGET);
    // A tenant no build default or host could produce, so a prefilled value can only be the one
    // typed. Platform answers 200 whatever the tenant and email, and the page shows one confirmation.
    const tenant = `e2e-carry-${randomUUID().slice(0, 8)}`;
    const email = `nobody-${randomUUID().slice(0, 8)}@example.test`;

    await page.goto('/login');
    // The field starts open only when the console resolves no tenant; the toggle renders with it,
    // so once the toggle is visible the field's state is settled.
    const toggle = page.getByTestId('login-tenant-toggle');
    await expect(toggle).toBeVisible();
    const tenantInput = page.getByTestId('login-tenant');
    if (!(await tenantInput.isVisible())) await toggle.click();
    await tenantInput.fill(tenant);
    await page.getByTestId('login-forgot-password').click();

    await expect(page.getByTestId('forgot-tenant')).toHaveValue(tenant);
    expect(page.url()).not.toContain(tenant);

    await page.getByTestId('forgot-email').fill(email);
    const request = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname === FORGOT_PATH,
    );
    await page.getByTestId('forgot-submit').click();

    expect((await request).postDataJSON()).toEqual({ tenantId: tenant, email });
    await expect(page.getByTestId('forgot-sent')).toBeVisible();
  });

  test('the reset page reports an invalid token by its code', async ({ page }) => {
    test.setTimeout(TEST_BUDGET);
    // A well-formed Base64 token that Platform never issued.
    const token = Buffer.from(randomUUID()).toString('base64');

    await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
    await page.getByTestId('reset-new-password').fill(NEW_PASSWORD);
    await page.getByTestId('reset-confirm-password').fill(NEW_PASSWORD);
    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === RESET_PATH,
    );
    await page.getByTestId('reset-submit').click();

    expect((await response).status()).toBe(400);
    await expect(page.getByTestId('reset-error')).toHaveAttribute(
      'data-error-code',
      'reset-invalid',
    );
  });
});
