import { createHash } from 'node:crypto';
import type { Page, Request, TestInfo } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { authenticatedPage } from '../../helpers/auth-session';
import { API_BASE, DEMO_ADMIN } from '../../helpers/credentials';

/**
 * A live console survives a REAL access-token expiry: Platform closes the hub connection at the
 * token's `exp` and the console reconnects with a refreshed token, without a sign-out. Change
 * `a-suspended-account-is-visible-and-enforced-in-the-console`, task 9.5 (design D4, D6, D9).
 *
 * Platform (>= v2.24.0) hard-codes the access token to 15 minutes, closes every live hub connection
 * at its token's `exp` with `{"type":7,"allowReconnect":true}` (a close request, not an abort), ends
 * the SSE stream at the same instant, and refuses a token at `exp` (no skew). Nothing is faked here:
 * the test holds one throwaway Supervisor's console open on `/operations/agents` for a whole token
 * period, so **one run takes about 17 minutes**.
 *
 * It asserts, in order:
 *  1. signed in, `data-realtime-state="connected"`; the hub WebSocket's `access_token` and the SSE
 *     request's `token` are captured (the same token, T1);
 *  2. the server closes that hub socket no earlier than `exp(T1) - 5 s` and within `exp(T1) + 90 s`,
 *     with the expiry close frame `{"type":7,"allowReconnect":true}`;
 *  3. a NEW hub socket opens with a different token whose `exp` is later, no reconnect presents T1,
 *     the shell returns to `connected`, and its state only ever moved between `connected` and
 *     `reconnecting` (never `ended`, `failed` or `disconnected`);
 *  4. the page never navigates to `/login` and the user stays signed in;
 *  5. the SSE stream reopens with the fresh token, and no stream is opened with T1 at or after
 *     `exp(T1)`.
 *
 * The SSE assertion is deliberately not pinned to "after `exp`". Today the stream reopens after
 * `exp`: the proactive refresh at `exp - 60 s` is a no-op under Web Locks (follow-up 11.10), so
 * the token rotates only when the expiry ends the hub connection and the stream. Once that is
 * fixed, the token rotates at `exp - 60 s` and the stream reopens then, which is still correct.
 * Every timing (refreshes, sockets, streams, state changes, navigations, console errors) is
 * printed and attached as `expiry-timeline`, with tokens reduced to fingerprints.
 *
 * Opt-in twice over, because of the wall-clock cost:
 *  - `E2E_FULL_STACK=true`: the full lab stack (Platform's `docker/docker-compose.full.yml`) with the
 *    change's local override `lab/docker-compose.backplane.override.yml`. Its shared-JWT-key-pool
 *    lines are what let any hub connect at all (without them every negotiate answers 401);
 *  - `E2E_TOKEN_EXPIRY=true`: accept a ~17-minute test.
 *
 * Run with `E2E_FULL_STACK=true E2E_TOKEN_EXPIRY=true npm run e2e -- auth/session-expiry.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true' && process.env.E2E_TOKEN_EXPIRY === 'true';

const HUB_PATH = '/hubs/platform';
const SSE_PATH = '/api/v1/events/stream';
const REFRESH_PATH = '/api/v1/auth/refresh';

/** The hub connects after the shell mounts, through negotiate and the WebSocket upgrade. */
const HUB_CONNECT_TIMEOUT = 15_000;

/** The expiry close may not come earlier than this before `exp` (Realtime closes AT `exp`). */
const CLOSE_EARLIEST_BEFORE_EXP_MS = 5_000;

/** ... and must come within this after `exp`. */
const CLOSE_LATEST_AFTER_EXP_MS = 90_000;

/**
 * From the expiry close to a new socket and `connected`: the refresh, negotiate and the upgrade,
 * inside the library's default retry delays (0, 2, 10, 30 s). A bound for `expect`, never a sleep.
 */
const RECONNECT_TIMEOUT = 60_000;

/** The idle-timeout warning opens this long before the idle deadline (`WARNING_BEFORE_MS`). */
const IDLE_WARNING_LEAD_MS = 60_000;

/**
 * The test's budget: one token period (15 minutes from the restore), the close window, the
 * reconnect and the setup. A budget, not a wait: every step is fenced on an event or an attribute.
 */
const TEST_BUDGET = 25 * 60_000;

interface HubSocketRecord {
  readonly token: string;
  readonly openedAt: number;
  closedAt: number | null;
  closeFrame: Record<string, unknown> | null;
  closeFrameAt: number | null;
  readonly socketErrors: string[];
}

interface HttpRecord {
  readonly request: Request;
  readonly requestedAt: number;
  status: number | null;
  respondedAt: number | null;
  endedAt: number | null;
  failure: string | null;
}

interface StreamRecord extends HttpRecord {
  readonly token: string;
}

interface Observation {
  readonly startedAt: number;
  readonly hubSockets: HubSocketRecord[];
  readonly streams: StreamRecord[];
  readonly refreshes: HttpRecord[];
  readonly realtimeStates: { at: number; state: string }[];
  readonly navigations: { at: number; path: string }[];
  readonly console: { at: number; type: string; text: string }[];
}

function pathOf(url: string): string {
  return new URL(url).pathname;
}

/** When a JWT expires, from its `exp` claim (Unix seconds), in epoch milliseconds. */
function jwtExpiryMs(token: string): number {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('the token is not a JWT');
  const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    exp?: unknown;
  };
  if (typeof exp !== 'number') throw new Error('the JWT carries no numeric exp');
  return exp * 1000;
}

/** {@link jwtExpiryMs}, or 0 for anything that is not a JWT with an `exp` (for polling callbacks). */
function jwtExpiryOrZero(token: string): number {
  try {
    return jwtExpiryMs(token);
  } catch {
    return 0;
  }
}

/** A short, stable stand-in for a token, so no credential reaches a log or an attachment. */
function fingerprint(token: string): string {
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 12) : '(none)';
}

function redactTokens(text: string): string {
  return text.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>');
}

/**
 * Wires every recorder onto the page before its first navigation: hub sockets (token, open, close,
 * the close frame), SSE requests and their outcome, refresh calls, the shell's realtime state (by a
 * MutationObserver reporting through a binding, so each change is stamped on the test's clock),
 * main-frame navigations and console errors.
 */
async function observe(page: Page): Promise<Observation> {
  const observation: Observation = {
    startedAt: Date.now(),
    hubSockets: [],
    streams: [],
    refreshes: [],
    realtimeStates: [],
    navigations: [],
    console: [],
  };

  page.on('websocket', (ws) => {
    if (pathOf(ws.url()) !== HUB_PATH) return;
    const socket: HubSocketRecord = {
      token: new URL(ws.url()).searchParams.get('access_token') ?? '',
      openedAt: Date.now(),
      closedAt: null,
      closeFrame: null,
      closeFrameAt: null,
      socketErrors: [],
    };
    observation.hubSockets.push(socket);
    ws.on('framereceived', ({ payload }) => {
      const text = typeof payload === 'string' ? payload : payload.toString('utf8');
      for (const part of text.split('\u001e')) {
        if (!part) continue;
        try {
          const message = JSON.parse(part) as Record<string, unknown>;
          if (message.type === 7) {
            socket.closeFrame = message;
            socket.closeFrameAt = Date.now();
          }
        } catch {
          // Not a JSON hub message (the protocol is JSON; nothing else is expected).
        }
      }
    });
    ws.on('socketerror', (error) => socket.socketErrors.push(redactTokens(error)));
    ws.on('close', () => {
      socket.closedAt = Date.now();
    });
  });

  const recordOf = (request: Request): HttpRecord | undefined =>
    observation.streams.find((r) => r.request === request) ??
    observation.refreshes.find((r) => r.request === request);

  page.on('request', (request) => {
    const path = pathOf(request.url());
    const base = {
      request,
      requestedAt: Date.now(),
      status: null,
      respondedAt: null,
      endedAt: null,
      failure: null,
    };
    if (request.method() === 'GET' && path === SSE_PATH) {
      const token = new URL(request.url()).searchParams.get('token') ?? '';
      observation.streams.push({ ...base, token });
    } else if (request.method() === 'POST' && path === REFRESH_PATH) {
      observation.refreshes.push(base);
    }
  });
  page.on('response', (response) => {
    const record = recordOf(response.request());
    if (!record) return;
    record.status = response.status();
    record.respondedAt = Date.now();
  });
  page.on('requestfinished', (request) => {
    const record = recordOf(request);
    if (record) record.endedAt = Date.now();
  });
  page.on('requestfailed', (request) => {
    const record = recordOf(request);
    if (!record) return;
    record.endedAt = Date.now();
    record.failure = request.failure()?.errorText ?? 'failed';
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      observation.navigations.push({ at: Date.now(), path: pathOf(frame.url()) });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      observation.console.push({
        at: Date.now(),
        type: message.type(),
        text: redactTokens(message.text()),
      });
    }
  });
  page.on('pageerror', (error) => {
    observation.console.push({
      at: Date.now(),
      type: 'pageerror',
      text: redactTokens(error.message),
    });
  });

  await page.exposeBinding('__e2eRealtimeState', (_source, state: string) => {
    observation.realtimeStates.push({ at: Date.now(), state });
  });
  await page.addInitScript(() => {
    let last: string | null = null;
    const report = (): void => {
      const state =
        document.querySelector('[data-testid="app-shell"]')?.getAttribute('data-realtime-state') ??
        null;
      if (state === null || state === last) return;
      last = state;
      void (window as unknown as { __e2eRealtimeState?: (s: string) => Promise<void> })
        .__e2eRealtimeState?.(state)
        .catch(() => undefined);
    };
    new MutationObserver(report).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-realtime-state'],
    });
  });

  return observation;
}

/** Seconds from `exp(T1)`, one decimal; `null` when the event never happened. */
function sinceExp(at: number | null, expMs: number): number | null {
  return at === null ? null : Math.round((at - expMs) / 100) / 10;
}

/** The run's timeline relative to `exp(T1)`, printed and attached whether the test passes or not. */
async function reportTimeline(
  testInfo: TestInfo,
  observation: Observation,
  expMs: number | null,
): Promise<void> {
  const origin = expMs ?? observation.startedAt;
  const at = (t: number | null) => sinceExp(t, origin);
  const tokenExp = (token: string) => {
    const ms = jwtExpiryOrZero(token);
    return ms ? new Date(ms).toISOString() : null;
  };
  const timeline = {
    origin: expMs === null ? 'test start (exp(T1) was never captured)' : 'exp(T1)',
    expT1: expMs === null ? null : new Date(expMs).toISOString(),
    secondsRelativeToOrigin: {
      refreshes: observation.refreshes.map((r) => ({
        requested: at(r.requestedAt),
        status: r.status,
      })),
      hubSockets: observation.hubSockets.map((s) => ({
        token: fingerprint(s.token),
        tokenExp: tokenExp(s.token),
        opened: at(s.openedAt),
        closed: at(s.closedAt),
        closeFrame: s.closeFrame,
        closeFrameAt: at(s.closeFrameAt),
        socketErrors: s.socketErrors,
      })),
      streams: observation.streams.map((s) => ({
        token: fingerprint(s.token),
        tokenExp: tokenExp(s.token),
        requested: at(s.requestedAt),
        status: s.status,
        responded: at(s.respondedAt),
        ended: at(s.endedAt),
        failure: s.failure,
      })),
      realtimeStates: observation.realtimeStates.map((s) => ({ at: at(s.at), state: s.state })),
      navigations: observation.navigations.map((n) => ({ at: at(n.at), path: n.path })),
      console: observation.console.map((c) => ({ at: at(c.at), type: c.type, text: c.text })),
    },
  };
  const body = JSON.stringify(timeline, null, 2);
  console.log(`expiry-timeline\n${body}`);
  await testInfo.attach('expiry-timeline', { body, contentType: 'application/json' });
}

test.describe('Session survives a real token expiry (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true and E2E_TOKEN_EXPIRY=true (one run takes ~17 minutes; see above)',
  );
  // An attempt costs a whole token period, and a pass that needed a retry is a timing bug, not a
  // pass: report the first attempt as it is.
  test.describe.configure({ retries: 0 });

  test('a live console reconnects across the server expiry close with a refreshed token and stays signed in', async ({
    browser,
    demoApiContext,
    playwright,
  }, testInfo) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account = {
      tenantId: 'demo',
      email: `e2e-expiry-${stamp}@demo.local`,
      password: 'E2eExpiry!2026x',
    };
    const created = await demoApiContext.post(`${API_BASE}/api/v1/admin/users`, {
      data: {
        email: account.email,
        displayName: `E2E Expiry ${stamp}`,
        role: 'Supervisor',
        password: account.password,
      },
    });
    expect(created.status()).toBe(201);
    const { id: userId } = (await created.json()) as { id: string };

    let userPage: Page | undefined;
    let observation: Observation | undefined;
    let expT1: number | null = null;
    try {
      userPage = await authenticatedPage(browser, account);
      observation = await observe(userPage);
      const obs = observation;

      // ── 1. Signed in, hub connected; T1 captured from the hub socket and the SSE request ─────
      // The restore's refresh answer carries the tenant's idle timeout (read for a precondition).
      const restoreBody = userPage
        .waitForResponse(
          (response) =>
            response.request().method() === 'POST' && pathOf(response.url()) === REFRESH_PATH,
        )
        .then(
          async (response) => (await response.json()) as { sessionIdleTimeoutMinutes?: unknown },
        )
        .catch(() => ({ sessionIdleTimeoutMinutes: undefined }));
      await userPage.goto('/operations/agents');
      await waitForAppReady(userPage);
      const shell = userPage.getByTestId('app-shell');
      await expect(shell).toHaveAttribute('data-realtime-state', 'connected', {
        timeout: HUB_CONNECT_TIMEOUT,
      });

      await expect
        .poll(() => obs.hubSockets.filter((s) => s.closedAt === null).length, {
          message: 'exactly one hub WebSocket is open once the shell reads connected',
        })
        .toBe(1);
      const hub1 = obs.hubSockets.find((s) => s.closedAt === null)!;
      const tokenT1 = hub1.token;
      expect(tokenT1, 'the hub WebSocket carries an access_token').toMatch(/^eyJ/);
      expT1 = jwtExpiryMs(tokenT1);
      const exp1 = expT1;

      await expect
        .poll(() => obs.streams.length, { message: 'the SSE stream is requested' })
        .toBeGreaterThan(0);
      expect(
        fingerprint(obs.streams.at(-1)!.token),
        'the SSE stream is opened on the same token as the hub (T1)',
      ).toBe(fingerprint(tokenT1));

      // Precondition, not a product assertion: the tenant's idle timeout must not sign the console
      // out before the observation ends (the page is deliberately left untouched).
      const { sessionIdleTimeoutMinutes } = await restoreBody;
      // The console's own default (`resolveIdleMinutes`): 30 minutes unless a positive number.
      const idleMinutes =
        typeof sessionIdleTimeoutMinutes === 'number' && sessionIdleTimeoutMinutes > 0
          ? sessionIdleTimeoutMinutes
          : 30;
      const observationEnd = exp1 + CLOSE_LATEST_AFTER_EXP_MS + RECONNECT_TIMEOUT;
      expect(
        obs.startedAt + idleMinutes * 60_000 - IDLE_WARNING_LEAD_MS,
        `precondition: the tenant's idle timeout (${idleMinutes} min) outlasts the observation`,
      ).toBeGreaterThan(observationEnd);

      testInfo.annotations.push({
        type: 'timing',
        description: `T1 exp ${new Date(exp1).toISOString()}, ${Math.round((exp1 - Date.now()) / 1000)} s after connected`,
      });

      // ── 2. The server closes that socket at T1's expiry, with the expiry close frame ─────────
      await expect
        .poll(() => hub1.closedAt, {
          message: `the server closes the hub socket by exp(T1) + ${CLOSE_LATEST_AFTER_EXP_MS / 1000} s`,
          timeout: Math.max(exp1 + CLOSE_LATEST_AFTER_EXP_MS - Date.now(), 1_000),
          intervals: [1_000],
        })
        .not.toBeNull();
      const closedAt = hub1.closedAt!;
      expect(
        closedAt,
        `the hub socket is not closed earlier than exp(T1) - ${CLOSE_EARLIEST_BEFORE_EXP_MS / 1000} s`,
      ).toBeGreaterThanOrEqual(exp1 - CLOSE_EARLIEST_BEFORE_EXP_MS);
      expect(closedAt).toBeLessThanOrEqual(exp1 + CLOSE_LATEST_AFTER_EXP_MS);
      expect(
        hub1.closeFrame,
        'the close came from the server as the expiry close request (allowReconnect)',
      ).toMatchObject({ type: 7, allowReconnect: true });
      testInfo.annotations.push({
        type: 'timing',
        description: `hub socket closed at exp(T1) ${sinceExp(closedAt, exp1)} s`,
      });

      // ── 3. A new socket with a fresh token; the shell returns to connected ───────────────────
      await expect
        .poll(() => obs.hubSockets.some((s) => s !== hub1 && s.token !== tokenT1), {
          message: 'a new hub WebSocket opens with a token other than T1',
          timeout: RECONNECT_TIMEOUT,
        })
        .toBe(true);
      await expect(shell).toHaveAttribute('data-realtime-state', 'connected', {
        timeout: RECONNECT_TIMEOUT,
      });
      await expect
        .poll(() => obs.hubSockets.filter((s) => s.closedAt === null).length, {
          message: 'exactly one hub WebSocket is open after the reconnect',
        })
        .toBe(1);
      const hub2 = obs.hubSockets.find((s) => s.closedAt === null)!;
      expect(hub2, 'the live socket is a new one').not.toBe(hub1);
      expect(fingerprint(hub2.token), 'the new socket carries a different token').not.toBe(
        fingerprint(tokenT1),
      );
      expect(jwtExpiryMs(hub2.token), 'the new token expires later than T1').toBeGreaterThan(exp1);
      expect(
        obs.hubSockets.filter((s) => s !== hub1 && s.token === tokenT1).length,
        'no reconnect presents the expired token T1',
      ).toBe(0);

      const states = obs.realtimeStates.map((s) => s.state);
      const afterFirstConnected = states.slice(states.indexOf('connected') + 1);
      expect(
        afterFirstConnected.filter((s) => s !== 'connected' && s !== 'reconnecting'),
        `the hub only moves between connected and reconnecting (states: ${states.join(' → ')})`,
      ).toEqual([]);
      testInfo.annotations.push({
        type: 'timing',
        description: `new hub socket at exp(T1) ${sinceExp(hub2.openedAt, exp1)} s; states ${states.join(' → ')}`,
      });

      // ── 4. Never sent to /login; still signed in ─────────────────────────────────────────────
      expect(
        obs.navigations.filter((n) => n.path.startsWith('/login')),
        'the page never navigates to /login',
      ).toEqual([]);
      await expect(userPage).toHaveURL(/\/operations\/agents$/);
      await waitForAppReady(userPage);

      // ── 5. The SSE stream reopens with the fresh token, never with T1 after its expiry ───────
      await expect
        .poll(
          () => obs.streams.some((s) => s.token !== tokenT1 && jwtExpiryOrZero(s.token) > exp1),
          {
            message: 'the SSE stream is reopened with a fresh token (exp later than T1)',
            timeout: RECONNECT_TIMEOUT,
          },
        )
        .toBe(true);
      expect(
        obs.streams.filter((s) => s.token === tokenT1 && s.requestedAt >= exp1).length,
        'no SSE stream is opened with T1 at or after its expiry',
      ).toBe(0);
      const freshStream = obs.streams.at(-1)!;
      expect(fingerprint(freshStream.token), 'the latest stream carries the fresh token').not.toBe(
        fingerprint(tokenT1),
      );
      expect(freshStream.status ?? 200, 'the fresh stream is not refused').toBe(200);
      testInfo.annotations.push({
        type: 'timing',
        description: `fresh SSE stream requested at exp(T1) ${sinceExp(freshStream.requestedAt, exp1)} s`,
      });
    } finally {
      // Nothing here may throw: a failure in the cleanup must never replace the test's own error.
      if (observation) {
        await reportTimeline(testInfo, observation, expT1).catch((error: unknown) =>
          console.warn(`expiry-timeline could not be reported: ${String(error)}`),
        );
      }
      await userPage
        ?.context()
        .close()
        .catch(() => undefined);
      // The fixture's admin token has expired by now (15 minutes): sign in afresh to clean up.
      const cleanup = await playwright.request.newContext();
      try {
        const login = await cleanup.post(`${API_BASE}/api/v1/auth/login`, { data: DEMO_ADMIN });
        const { accessToken } = (await login.json()) as { accessToken: string };
        const deleted = await cleanup.delete(`${API_BASE}/api/v1/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-Id': DEMO_ADMIN.tenantId },
        });
        if (deleted.status() !== 204) {
          console.warn(`throwaway user ${userId} not deleted: ${deleted.status()}`);
        }
      } catch (error) {
        console.warn(`throwaway user ${userId} not deleted: ${String(error)}`);
      } finally {
        await cleanup.dispose();
      }
    }
  });
});
