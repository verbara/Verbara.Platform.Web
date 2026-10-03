import type { Page, Request, Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { authenticatedPage } from '../../helpers/auth-session';
import { API_BASE } from '../../helpers/credentials';

/**
 * A suspended account is signed out of its live console, refused at sign-in, and admitted again
 * once re-activated. Change `a-suspended-account-is-visible-and-enforced-in-the-console`, design
 * D9.
 *
 * Two browser contexts, as in `operations/realtime-presence.spec.ts`: the demo tenant's admin
 * drives the status through the console, and a throwaway Supervisor holds a live console with the
 * realtime hub and the SSE stream open.
 *
 * Requires the full lab stack (Platform >= v2.24.0 from `docker/docker-compose.full.yml`) with two
 * additions to `platform-api` that the shipped compose file lacks; the change carries them as a
 * local override (`lab/docker-compose.backplane.override.yml`):
 *  - the Redis push backplane (`ConnectionStrings__Redis`). Without it a revocation never reaches
 *    the hub, the console is never signed out, and this spec fails at the hub-close step;
 *  - the shared JWT key pool in Identity Redis. Without it Realtime refuses every negotiate (401),
 *    and this spec fails before the suspension, waiting for `data-realtime-state="connected"`.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e`.
 *
 * The expiry close (Platform ends the hub at the token's `exp`, 15 minutes) is covered in Vitest over
 * an in-memory SignalR transport, and against the real stack by the opt-in
 * `auth/session-expiry.spec.ts` (`E2E_TOKEN_EXPIRY=true`, about 17 minutes per run).
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

const HUB_PATH = '/hubs/platform';
const SSE_PATH = '/api/v1/events/stream';
const LOGIN_PATH = '/api/v1/auth/login';

/**
 * How long the suspension may take to reach the user's console: the `PUT` publishes
 * `user.access_revoked`, Platform.Api relays it over Redis, Realtime aborts the hub connection, and
 * the console probes the session (`POST /auth/refresh`, 401) before it signs out and reloads
 * `/login`. A bound for `expect`, never a sleep.
 */
const BACKPLANE_TIMEOUT = 20_000;

/** The hub connects after the shell mounts, through negotiate and the WebSocket upgrade. */
const HUB_CONNECT_TIMEOUT = 15_000;

/**
 * The test's budget: three fixture or API sign-ins, two form sign-ins, two status changes through
 * the console and the backplane hop. The suite default (30 s) does not cover the bounded waits
 * alone (two hub connects and three backplane steps, 90 s at worst), so a failing step reports its
 * own `expect` message instead of the test timeout. A budget, not a wait: every step below is
 * fenced on a response or an attribute. A passing run takes about 3 s on the lab stack.
 */
const TEST_BUDGET = 120_000;

type AccountStatusOption = 'Active' | 'Suspended';

function isUserUpdate(response: Response, userId: string): boolean {
  return (
    response.request().method() === 'PUT' &&
    new URL(response.url()).pathname === `/api/v1/admin/users/${userId}`
  );
}

/**
 * The SSE stream. `waitForRequest` and `waitForResponse` resolve on the first match, so the streams
 * the console reopens after an end are ignored.
 */
function isEventStream(request: Request): boolean {
  return request.method() === 'GET' && new URL(request.url()).pathname === SSE_PATH;
}

function isPasswordSignIn(response: Response): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === LOGIN_PATH;
}

/** Sets the account status from the user's detail page, fenced on the `PUT` answering 200. */
async function setStatusFromConsole(
  adminPage: Page,
  userId: string,
  status: AccountStatusOption,
): Promise<void> {
  await adminPage.getByTestId('user-edit-btn').click();
  await adminPage.getByTestId('user-form-status').click();
  await adminPage.getByTestId(`user-form-status-option-${status}`).click();

  const update = adminPage.waitForResponse((response) => isUserUpdate(response, userId));
  await adminPage.getByTestId('user-form-submit').click();
  expect((await update).status()).toBe(200);
}

/**
 * Signs in through the login form and returns the sign-in response. The tenant field must already
 * be open (see the first call site).
 */
async function signInThroughForm(
  page: Page,
  credentials: { tenantId: string; email: string; password: string },
): Promise<Response> {
  await page.getByTestId('login-tenant').fill(credentials.tenantId);
  await page.getByTestId('login-email').fill(credentials.email);
  await page.getByTestId('login-password').fill(credentials.password);

  const signIn = page.waitForResponse(isPasswordSignIn);
  await page.getByTestId('login-submit').click();
  return signIn;
}

test.describe('Account suspension (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true and docker-compose.full.yml with the lab override (see above)',
  );

  test('a suspended account is signed out of its live console, refused at sign-in, and admitted again once re-activated', async ({
    browser,
    demoAdminPage,
    demoApiContext,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account = {
      tenantId: 'demo',
      email: `e2e-suspension-${stamp}@demo.local`,
      password: 'E2eSuspension!2026',
    };

    const created = await demoApiContext.post(`${API_BASE}/api/v1/admin/users`, {
      data: {
        email: account.email,
        displayName: `E2E Suspension ${stamp}`,
        role: 'Supervisor',
        password: account.password,
      },
    });
    expect(created.status()).toBe(201);
    const { id: userId } = (await created.json()) as { id: string };

    let userPage: Page | undefined;
    try {
      // ── The user's live console: hub connected, SSE stream requested ─────────────────────────
      userPage = await authenticatedPage(browser, account);
      const hubSocket = userPage.waitForEvent('websocket', (ws) => ws.url().includes(HUB_PATH));
      const streamRequest = userPage.waitForRequest(isEventStream);
      // The stream's response, then its end. Behind the lab gateway the response can surface only
      // when the stream ends (nginx buffers the proxied stream, headers included), so this is
      // observed from before the navigation and asserted after the suspension. A navigation that
      // cuts the stream before the server ends it reads as `failed`, never as `ended`.
      let streamOutcome: 'open' | 'ended' | 'failed' = 'open';
      void userPage
        .waitForResponse((response) => isEventStream(response.request()), { timeout: 0 })
        .then(async (response) => {
          const failure = await response.finished();
          streamOutcome = response.status() === 200 && failure === null ? 'ended' : 'failed';
        })
        .catch(() => {
          streamOutcome = 'failed';
        });
      await userPage.goto('/operations');
      await waitForAppReady(userPage);

      const userShell = userPage.getByTestId('app-shell');
      await expect(userShell).toHaveAttribute('data-realtime-state', 'connected', {
        timeout: HUB_CONNECT_TIMEOUT,
      });

      // Observed from here on, so a close that lands before the assertion is not missed.
      const hub = await hubSocket;
      let hubClosed = hub.isClosed();
      hub.on('close', () => {
        hubClosed = true;
      });
      await streamRequest;

      // ── The admin suspends the account from the console ──────────────────────────────────────
      await demoAdminPage.goto(`/admin/users/${userId}`);
      await expect(demoAdminPage.getByTestId('user-detail-page')).toBeVisible();
      const statusBadge = demoAdminPage.getByTestId('user-status-badge');
      await expect(statusBadge).toHaveAttribute('data-status', 'active');

      await setStatusFromConsole(demoAdminPage, userId, 'Suspended');
      await expect(statusBadge).toHaveAttribute('data-status', 'suspended');

      // ── The user's console is ended by the server and lands on the session-ended notice ──────
      await expect
        .poll(() => hubClosed, {
          message: 'the hub WebSocket is closed by the server (Redis backplane → Realtime)',
          timeout: BACKPLANE_TIMEOUT,
        })
        .toBe(true);
      await expect
        .poll(() => streamOutcome, {
          message: 'the SSE stream is ended by the server',
          timeout: BACKPLANE_TIMEOUT,
        })
        .toBe('ended');

      await expect(userPage).toHaveURL(/\/login/, { timeout: BACKPLANE_TIMEOUT });
      await expect(userPage.getByTestId('login-notice')).toHaveAttribute(
        'data-notice-code',
        'session-ended',
      );

      // ── A sign-in while suspended is refused, and says why ───────────────────────────────────
      // The lab image is built with VITE_DEFAULT_TENANT_ID=platform, so the tenant field starts
      // collapsed on `platform`. Opened once here; it stays open across the refusal.
      await expect(userPage.getByTestId('login-tenant')).toBeHidden();
      await userPage.getByTestId('login-tenant-toggle').click();
      await expect(userPage.getByTestId('login-tenant')).toBeVisible();

      const refused = await signInThroughForm(userPage, account);
      expect(refused.status()).toBe(403);
      await expect(userPage.getByTestId('login-error')).toHaveAttribute(
        'data-error-code',
        'account-inactive',
      );

      // ── Re-activated, the account signs in again and gets a live console ─────────────────────
      await setStatusFromConsole(demoAdminPage, userId, 'Active');
      await expect(statusBadge).toHaveAttribute('data-status', 'active');

      const admitted = await signInThroughForm(userPage, account);
      expect(admitted.status()).toBe(200);
      await waitForAppReady(userPage);
      await expect(userPage.getByTestId('app-shell')).toHaveAttribute(
        'data-realtime-state',
        'connected',
        { timeout: HUB_CONNECT_TIMEOUT },
      );
    } finally {
      await userPage?.context().close();
      await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${userId}`);
    }
  });
});
