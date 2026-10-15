import type { Page, Response, Route } from '@playwright/test';
import { test, expect } from '@playwright/test';

/**
 * Sign-in refusals say what happened (change `sign-in-refusals-say-what-happened`, task 3.2).
 *
 * The refusals are answered by routes this spec installs, with the status, headers and `error` code
 * of the host change's frozen fixtures copied verbatim, so the console's mapping is exercised
 * whatever tenant state the lab holds. Every assertion reads `data-*` attributes only, so it holds
 * in every locale.
 *
 * Requires the console served at the suite's `baseURL` (the lab stack from
 * `docker/docker-compose.full.yml`). Run with
 * `E2E_FULL_STACK=true npm run e2e -- tests/auth/sign-in-refusals.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

const LOGIN_PATH = '/api/v1/auth/login';
const MFA_VERIFY_PATH = '/api/v1/auth/mfa/verify';

/** A page load and one or two stubbed round trips; the budget covers a cold console bundle. */
const TEST_BUDGET = 45_000;

/**
 * How long the MFA step may take to give way to the sign-in form after a spent challenge: the
 * console keeps the refusal on screen for about 3 s before it clears the challenge. A bound for
 * `expect`, never a sleep.
 */
const RETURN_TO_SIGN_IN_TIMEOUT = 10_000;

/** Throwaway credentials: every answer below comes from a stubbed route, never from Platform. */
const ACCOUNT = { email: 'e2e-refusal@example.test', password: 'E2e-Refusal-Pass-1!' };

// sign-in-refusal-codes.v1.json `tenantSuspended` (status, headers, body.error).
const TENANT_SUSPENDED = {
  status: 403,
  headers: { 'Content-Type': 'application/json' },
  body: { error: 'tenant-suspended' },
} as const;

// mfa-verify-refusals.v1.json `exhausted` (status, headers, body.error).
const MFA_CHALLENGE_EXHAUSTED = {
  status: 401,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: { error: 'mfa-challenge-exhausted' },
} as const;

/**
 * The MFA challenge a password sign-in answers for an account with MFA enrolled. Not part of the
 * host change's fixtures: it is the existing, unchanged sign-in wire, shaped as the login page reads
 * it (`requiresMfa` + `mfaToken`).
 */
const MFA_CHALLENGE = {
  status: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: { requiresMfa: true, mfaToken: 'e2e-mfa-challenge-token' },
} as const;

type Stub = { status: number; headers: Record<string, string>; body: unknown };

function isPost(response: Response, path: string): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === path;
}

/** Answers POSTs to `path` with `stub`; any other method goes on to the server. */
async function stubPost(page: Page, path: string, stub: Stub): Promise<void> {
  await page.route(`**${path}`, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: stub.status,
      headers: stub.headers,
      body: JSON.stringify(stub.body),
    });
  });
}

/** Fills the password form and submits it, fenced on the sign-in response. */
async function submitPasswordSignIn(page: Page): Promise<Response> {
  await page.getByTestId('login-email').fill(ACCOUNT.email);
  await page.getByTestId('login-password').fill(ACCOUNT.password);

  const signIn = page.waitForResponse((response) => isPost(response, LOGIN_PATH));
  await page.getByTestId('login-submit').click();
  return signIn;
}

test.describe('Sign-in refusals (full stack, stubbed refusals)', () => {
  test.skip(!SHOULD_RUN, 'requires E2E_FULL_STACK=true and docker-compose.full.yml');

  test('a sign-in answered 403 tenant-suspended shows the tenant-suspended message and stays on the login page', async ({
    page,
  }) => {
    test.setTimeout(TEST_BUDGET);
    await stubPost(page, LOGIN_PATH, TENANT_SUSPENDED);

    await page.goto('/login');
    const refused = await submitPasswordSignIn(page);
    expect(refused.status()).toBe(TENANT_SUSPENDED.status);

    await expect(page.getByTestId('login-error')).toHaveAttribute(
      'data-error-code',
      'tenant-suspended',
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('an MFA verify answered 401 mfa-challenge-exhausted shows the challenge-exhausted message and returns to the sign-in form', async ({
    page,
  }) => {
    test.setTimeout(TEST_BUDGET);
    await stubPost(page, LOGIN_PATH, MFA_CHALLENGE);
    await stubPost(page, MFA_VERIFY_PATH, MFA_CHALLENGE_EXHAUSTED);

    await page.goto('/login');
    const challenged = await submitPasswordSignIn(page);
    expect(challenged.status()).toBe(MFA_CHALLENGE.status);
    await expect(page.getByTestId('login-mfa-section')).toBeVisible();

    // The sixth digit submits the code.
    const verify = page.waitForResponse((response) => isPost(response, MFA_VERIFY_PATH));
    for (const [i, digit] of ['1', '2', '3', '4', '5', '6'].entries()) {
      await page.getByTestId(`login-mfa-digit-${i}`).fill(digit);
    }
    expect((await verify).status()).toBe(MFA_CHALLENGE_EXHAUSTED.status);

    await expect(page.getByTestId('login-mfa-error')).toHaveAttribute(
      'data-error-code',
      'challenge-exhausted',
    );

    await expect(page.getByTestId('login-mfa-section')).toBeHidden({
      timeout: RETURN_TO_SIGN_IN_TIMEOUT,
    });
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
