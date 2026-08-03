import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { customFetch, customFetchWithHeaders } from './client';

/**
 * Guards the request pre-flight (`ensureTokenBeforeRequest`).
 *
 * Credentials are no longer persisted (ADR-0011), so a reloaded tab rehydrates with a `user` but
 * NO access token. The old condition — `isTokenExpired() && accessToken` — skipped the refresh in
 * exactly that state, and any request issued while the session was restoring travelled
 * unauthenticated. It is keyed on `hasSession()` now, and lives in one place because both fetch
 * variants need it and previously duplicated it.
 */

const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

const FRESH_TOKEN = 'fresh-token';

function refreshSucceeds() {
  return http.post('/api/v1/auth/refresh', () =>
    HttpResponse.json({
      accessToken: FRESH_TOKEN,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
  );
}

/** The state a reloaded tab rehydrates into: identity persisted, credential gone. */
function rehydratedWithoutToken() {
  useAuthStore.setState({
    user: A_USER,
    tenantId: 'tenant-1',
    permissions: ['users:user:view'],
    accessToken: null,
    tokenExpiry: null,
  });
}

let assignedHref: string | null = null;
let originalLocation: PropertyDescriptor | undefined;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  sessionStorage.clear();

  // Stub `window.location.href` so the failure path's redirect is observable rather than a
  // jsdom navigation. `origin` and `href` are restated explicitly — they live on
  // Location.prototype, so the spread alone drops them, and BOTH are load-bearing here: the
  // client resolves request URLs against `origin`, and msw resolves relative handler paths
  // against `href` (an empty one silently stops every handler from matching).
  assignedHref = null;
  originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
  const { origin, href } = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      origin,
      set href(value: string) {
        assignedHref = value;
      },
      get href() {
        return assignedHref ?? href;
      },
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
});

describe('customFetch token pre-flight', () => {
  it('should_RefreshBeforeTheRequest_WhenSessionRehydratedWithoutAToken', async () => {
    rehydratedWithoutToken();

    let authHeader: string | null = null;
    server.use(
      refreshSucceeds(),
      http.get('/api/v1/test', ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).resolves.toEqual({
      ok: true,
    });

    // Under the old condition this request went out with no Authorization header at all.
    expect(authHeader).toBe(`Bearer ${FRESH_TOKEN}`);
  });

  it('should_LogOutAndRedirect_WhenThePreflightRefreshFails', async () => {
    rehydratedWithoutToken();

    // No handler for /api/v1/test: the suite runs with `onUnhandledRequest: 'error'`, so the
    // request leaving at all would fail this test — which is precisely the contract.
    server.use(http.post('/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })));

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).rejects.toThrow(
      'Session expired',
    );

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(assignedHref).toBe('/login');
  });

  it('should_SkipTheRefresh_WhenThereIsNoSession', async () => {
    // Anonymous callers (the login page) must not pay a refresh round-trip. No /auth/refresh
    // handler is registered, so attempting one would fail the run.
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json({ ok: true })));

    await expect(
      customFetch({ url: '/api/v1/auth/login', method: 'POST', data: { email: 'a@b.com' } }),
    ).resolves.toEqual({ ok: true });
  });

  it('should_SkipTheRefresh_WhenTheTokenIsStillValid', async () => {
    useAuthStore
      .getState()
      .setAuth('live-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});

    server.use(http.get('/api/v1/test', () => HttpResponse.json({ ok: true })));

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).resolves.toEqual({
      ok: true,
    });
  });
});

describe('customFetchWithHeaders token pre-flight', () => {
  it('should_ApplyTheSamePreflight_WhenSessionRehydratedWithoutAToken', async () => {
    rehydratedWithoutToken();

    let authHeader: string | null = null;
    server.use(
      refreshSucceeds(),
      http.get('/api/v1/test', ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return HttpResponse.json({ value: 1 }, { headers: { 'X-Metrics-Available': 'true' } });
      }),
    );

    const result = await customFetchWithHeaders<{ value: number }>({
      url: '/api/v1/test',
      method: 'GET',
    });

    expect(result.data).toEqual({ value: 1 });
    expect(result.headers.get('X-Metrics-Available')).toBe('true');
    // The metrics-aware variant used to duplicate the pre-flight condition; it now shares one.
    expect(authHeader).toBe(`Bearer ${FRESH_TOKEN}`);
  });
});
