import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { customFetch, customFetchWithHeaders, refreshAccessToken } from './client';

/**
 * The impersonation path never borrows the operator's credentials (H17, H18; design D3, D4;
 * `specs/impersonation-session`).
 *
 * The refresh cookie belongs to the operator's own sign-in. While an impersonation is active, a
 * token minted from it would put the operator's own rights next to the impersonated tenant, so no
 * refresh path may install one; a request Platform refuses with 401 ends the impersonation locally
 * and is never replayed with the operator's token; and every request names the impersonated tenant.
 *
 * No page starts an impersonation today, so the store is driven with `startImpersonation` directly.
 */

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

const OPERATOR_TOKEN = 'operator-token';
const IMPERSONATION_TOKEN = 'impersonation-token';
const MINTED_FROM_COOKIE = 'minted-from-the-operator-cookie';

/** Counts `POST /auth/refresh` calls; each one mints a token for the cookie's owner, the operator. */
let refreshCalls = 0;
function refreshMintsTheOperatorToken() {
  return http.post('/api/v1/auth/refresh', () => {
    refreshCalls += 1;
    return HttpResponse.json({
      accessToken: MINTED_FROM_COOKIE,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
  });
}

interface SeenRequest {
  readonly authorization: string | null;
  readonly tenant: string | null;
}

/** Records every call to `/api/v1/test`; answers 401 to `refuse`d tokens and 200 otherwise. */
function recordingEndpoint(seen: SeenRequest[], refuse: readonly string[] = []) {
  const handler = ({ request }: { request: Request }) => {
    const authorization = request.headers.get('Authorization');
    seen.push({ authorization, tenant: request.headers.get('X-Tenant-Id') });
    if (refuse.some((token) => authorization === `Bearer ${token}`)) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({ ok: true });
  };
  return [http.get('/api/v1/test', handler), http.post('/api/v1/test', handler)];
}

/** An operator of `tenant-1` (selected in the tenant store at sign-in) impersonating `tenant-9`. */
function impersonate({
  operatorExpiry = Date.now() + 3600_000,
  impersonationExpiry = Date.now() + 600_000,
}: { operatorExpiry?: number; impersonationExpiry?: number } = {}): void {
  useAuthStore
    .getState()
    .setAuth(OPERATOR_TOKEN, operatorExpiry, A_USER, 'tenant-1', ['users:user:view'], {});
  useTenantStore.getState().setActiveTenant('tenant-1');
  useAuthStore.getState().startImpersonation(
    {
      accessToken: IMPERSONATION_TOKEN,
      expiresAt: new Date(impersonationExpiry).toISOString(),
      targetTenantId: 'tenant-9',
      targetTenantName: 'ACME',
    },
    OPERATOR_TOKEN,
    'tenant-1',
  );
}

function expectTheOperatorIsBackInTheirOwnSession(): void {
  const state = useAuthStore.getState();
  expect(state.impersonation).toBeNull();
  expect(state.accessToken).toBe(OPERATOR_TOKEN);
  expect(state.tenantId).toBe('tenant-1');
  // Ending an impersonation is not a sign-out (ADR-0009): the operator's own session holds.
  expect(state.user).toEqual(A_USER);
}

/** The element the last `toast.info` rendered, as a user would see it. */
function lastNotice(): HTMLElement | null {
  const content = vi.mocked(toast.info).mock.calls.at(-1)?.[0] as ReactElement | undefined;
  if (!content) return null;
  render(<div data-testid="toast">{content}</div>);
  return screen.getByTestId('toast').querySelector('[data-notice-code]');
}

/** A minimal serial stand-in for `navigator.locks` (jsdom has none). */
function installFakeLocks(): void {
  let chain: Promise<unknown> = Promise.resolve();
  Object.defineProperty(globalThis.navigator, 'locks', {
    configurable: true,
    value: {
      request: <T,>(_name: string, cb: () => Promise<T>): Promise<T> => {
        const result = chain.then(() => cb());
        chain = result.catch(() => undefined);
        return result;
      },
    },
  });
}

function removeLocks(): void {
  Object.defineProperty(globalThis.navigator, 'locks', { configurable: true, value: undefined });
}

let assignedHref: string | null = null;
let originalLocation: PropertyDescriptor | undefined;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  useTenantStore.setState({ activeTenantId: null });
  sessionStorage.clear();
  refreshCalls = 0;
  vi.mocked(toast.info).mockClear();
  removeLocks();

  // Observe the sign-out redirect instead of letting jsdom navigate (see preflight-refresh.test).
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
  removeLocks();
  vi.useRealTimers();
  if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
});

describe('refreshAccessToken during an impersonation (3.1 a)', () => {
  it('should_KeepTheImpersonationToken_WhenARefreshRunsWithoutWebLocks', async () => {
    impersonate();
    server.use(refreshMintsTheOperatorToken());

    await refreshAccessToken();

    expect(refreshCalls).toBe(0);
    expect(useAuthStore.getState().accessToken).toBe(IMPERSONATION_TOKEN);
  });

  it('should_KeepTheImpersonationToken_WhenARefreshRunsInItsLast30SecondsUnderWebLocks', async () => {
    installFakeLocks();
    impersonate({ impersonationExpiry: Date.now() + 10_000 });
    server.use(refreshMintsTheOperatorToken());

    await expect(refreshAccessToken()).resolves.toBe(true);

    expect(refreshCalls).toBe(0);
    expect(useAuthStore.getState().accessToken).toBe(IMPERSONATION_TOKEN);
  });

  it('should_ReportFalse_WhenTheImpersonationTokenIsPastItsExpiry', async () => {
    impersonate({ impersonationExpiry: Date.now() - 1_000 });
    server.use(refreshMintsTheOperatorToken());

    await expect(refreshAccessToken()).resolves.toBe(false);

    expect(refreshCalls).toBe(0);
  });
});

describe('the request pre-flight during an impersonation', () => {
  it('should_SendTheImpersonationToken_WhenItIsInItsLast30Seconds', async () => {
    impersonate({ impersonationExpiry: Date.now() + 10_000 });
    const seen: SeenRequest[] = [];
    server.use(refreshMintsTheOperatorToken(), ...recordingEndpoint(seen));

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).resolves.toEqual({
      ok: true,
    });

    expect(refreshCalls).toBe(0);
    expect(seen).toEqual([{ authorization: `Bearer ${IMPERSONATION_TOKEN}`, tenant: 'tenant-9' }]);
  });

  it('should_EndTheImpersonationWithoutSending_WhenItsTokenIsPastExpiry', async () => {
    impersonate({ impersonationExpiry: Date.now() - 1_000 });
    const seen: SeenRequest[] = [];
    server.use(refreshMintsTheOperatorToken(), ...recordingEndpoint(seen));

    await expect(customFetch({ url: '/api/v1/test', method: 'POST' })).rejects.toMatchObject({
      name: 'ImpersonationEndedError',
    });

    expect(seen).toEqual([]);
    expect(refreshCalls).toBe(0);
    expectTheOperatorIsBackInTheirOwnSession();
    expect(assignedHref).toBeNull();
    expect(lastNotice()).toHaveAttribute('data-notice-code', 'impersonation-ended');
  });
});

describe('a 401 during an impersonation (3.1 b)', () => {
  it.each([
    ['customFetch', customFetch],
    ['customFetchWithHeaders', customFetchWithHeaders],
  ] as const)(
    'should_EndTheImpersonationWithoutReplaying_When%sIsRefusedWith401',
    async (_name, fetcher) => {
      impersonate();
      const seen: SeenRequest[] = [];
      // Platform revoked the impersonation token; the operator's own tokens would still pass.
      server.use(refreshMintsTheOperatorToken(), ...recordingEndpoint(seen, [IMPERSONATION_TOKEN]));

      await expect(
        fetcher({ url: '/api/v1/test', method: 'POST', data: { write: 1 } }),
      ).rejects.toMatchObject({ name: 'ImpersonationEndedError' });

      // The write went out once, with the impersonation token, and was never sent again.
      expect(seen).toEqual([
        { authorization: `Bearer ${IMPERSONATION_TOKEN}`, tenant: 'tenant-9' },
      ]);
      expect(refreshCalls).toBe(0);
      expectTheOperatorIsBackInTheirOwnSession();
      expect(assignedHref).toBeNull();
      expect(lastNotice()).toHaveAttribute('data-notice-code', 'impersonation-ended');
    },
  );

  it('should_ShowTheEndedNoticeOnce_WhenConcurrentRequestsAreRefused', async () => {
    impersonate();
    const seen: SeenRequest[] = [];
    server.use(...recordingEndpoint(seen, [IMPERSONATION_TOKEN]));

    const results = await Promise.allSettled([
      customFetch({ url: '/api/v1/test', method: 'GET' }),
      customFetch({ url: '/api/v1/test', method: 'GET' }),
    ]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(seen).toHaveLength(2);
    expectTheOperatorIsBackInTheirOwnSession();
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('should_StillRefreshAndRetryOnce_WhenNoImpersonationIsActive', async () => {
    useAuthStore
      .getState()
      .setAuth(OPERATOR_TOKEN, Date.now() + 3600_000, A_USER, 'tenant-1', [], {});
    const seen: SeenRequest[] = [];
    server.use(refreshMintsTheOperatorToken(), ...recordingEndpoint(seen, [OPERATOR_TOKEN]));

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).resolves.toEqual({
      ok: true,
    });

    expect(refreshCalls).toBe(1);
    expect(seen.map((r) => r.authorization)).toEqual([
      `Bearer ${OPERATOR_TOKEN}`,
      `Bearer ${MINTED_FROM_COOKIE}`,
    ]);
    expect(toast.info).not.toHaveBeenCalled();
  });
});

describe('the tenant header during an impersonation (3.1 e)', () => {
  it('should_NameTheImpersonatedTenant_WhenTheOperatorSelectedTheirOwnAtSignIn', async () => {
    impersonate();
    const seen: SeenRequest[] = [];
    server.use(...recordingEndpoint(seen));

    await customFetch({ url: '/api/v1/test', method: 'GET' });

    expect(seen).toEqual([{ authorization: `Bearer ${IMPERSONATION_TOKEN}`, tenant: 'tenant-9' }]);
  });

  it('should_NameTheImpersonatedTenant_ForCustomFetchWithHeadersToo', async () => {
    impersonate();
    const seen: SeenRequest[] = [];
    server.use(...recordingEndpoint(seen));

    await customFetchWithHeaders({ url: '/api/v1/test', method: 'GET' });

    expect(seen.map((r) => r.tenant)).toEqual(['tenant-9']);
  });
});

describe('every end path returns the request to the operator (3.3)', () => {
  it('should_NameTheOperatorTenant_AfterTheBannerEnd', async () => {
    impersonate();
    useAuthStore.getState().endImpersonation();
    const seen: SeenRequest[] = [];
    server.use(...recordingEndpoint(seen));

    await customFetch({ url: '/api/v1/test', method: 'GET' });

    expect(seen).toEqual([{ authorization: `Bearer ${OPERATOR_TOKEN}`, tenant: 'tenant-1' }]);
  });

  it('should_NameTheOperatorTenant_AfterTheImpersonationExpired', async () => {
    impersonate({ impersonationExpiry: Date.now() - 1_000 });
    const seen: SeenRequest[] = [];
    server.use(...recordingEndpoint(seen));

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).rejects.toMatchObject({
      name: 'ImpersonationEndedError',
    });
    await customFetch({ url: '/api/v1/test', method: 'GET' });

    expect(seen).toEqual([{ authorization: `Bearer ${OPERATOR_TOKEN}`, tenant: 'tenant-1' }]);
  });

  it('should_NameTheOperatorTenant_AfterARefusedImpersonationToken', async () => {
    impersonate();
    const seen: SeenRequest[] = [];
    server.use(...recordingEndpoint(seen, [IMPERSONATION_TOKEN]));

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).rejects.toMatchObject({
      name: 'ImpersonationEndedError',
    });
    await customFetch({ url: '/api/v1/test', method: 'GET' });

    expect(seen.at(-1)).toEqual({ authorization: `Bearer ${OPERATOR_TOKEN}`, tenant: 'tenant-1' });
  });

  it('should_RefreshBeforeTheNextRequest_WhenTheOperatorTokenExpiredDuringTheImpersonation', async () => {
    // The operator's own token expired during a long impersonation (spec: "The operator's token
    // expired during a long impersonation").
    impersonate({ operatorExpiry: Date.now() - 60_000 });
    useAuthStore.getState().endImpersonation();
    const seen: SeenRequest[] = [];
    server.use(refreshMintsTheOperatorToken(), ...recordingEndpoint(seen, [OPERATOR_TOKEN]));

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).resolves.toEqual({
      ok: true,
    });

    expect(refreshCalls).toBe(1);
    // No request went out with the expired operator token.
    expect(seen).toEqual([{ authorization: `Bearer ${MINTED_FROM_COOKIE}`, tenant: 'tenant-1' }]);
  });
});
