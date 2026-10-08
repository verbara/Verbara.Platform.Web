import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

/**
 * A single sign-on that Platform answers with an MFA challenge opens the MFA step (change
 * `the-console-account-and-session-surfaces-match-the-api`, H22, spec `sign-in-refusal-feedback`).
 *
 * Platform's OIDC callback redirects a user with MFA enrolled to
 * `/login#oidc_mfa_challenge&challenge_token=…&tenant_id=…`. Driving a real identity provider is
 * outside the lab, so the spec loads that redirect target with a generated token: the page must open
 * the MFA step and drop the fragment. Verifying a code needs a real challenge and is covered in
 * Vitest (`login-page.test.tsx`).
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- tests/auth/oidc-mfa-challenge.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/** One page load, no API round trip; the explicit budget covers a cold console bundle. */
const TEST_BUDGET = 45_000;

test.describe('Single sign-on MFA challenge (full stack)', () => {
  test.skip(!SHOULD_RUN, 'requires E2E_FULL_STACK=true and docker-compose.full.yml');

  test('the login page opens the MFA step from the challenge fragment and removes it', async ({
    page,
  }) => {
    test.setTimeout(TEST_BUDGET);
    const token = randomUUID();

    await page.goto(
      `/login#oidc_mfa_challenge&challenge_token=${encodeURIComponent(token)}&tenant_id=demo`,
    );

    await expect(page.getByTestId('login-mfa-section')).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
  });
});
