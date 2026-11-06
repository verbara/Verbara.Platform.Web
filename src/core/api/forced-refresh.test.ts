import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A server 401 forces one real refresh before the single retry (change `cdr-list-reads-its-envelope`,
 * design W7, spec `auth-token-storage`; host `call-records-are-written-once` B.8e).
 *
 * These tests run the REAL auth store and the REAL session channel: each "tab" is its own module graph
 * (`vi.resetModules()` between imports), so each holds its own token in memory, exactly as two browser
 * tabs do. Only `fetch` and `navigator.locks` are faked — jsdom has no Web Locks, and without the fake
 * the client takes its no-locks branch, which hides the held-token fast path this change replaces.
 */

type ClientModule = typeof import('./client');
type AuthStoreModule = typeof import('@/core/auth/auth-store');

interface Tab {
  client: ClientModule;
  auth: AuthStoreModule;
}

const STREAM_URL = '/api/v1/recordings/s-1/stream';
const REFRESH_URL = '/api/v1/auth/refresh';
const USER = { id: 'u1', email: 'op@example.com', displayName: 'Op', role: 'Admin' };

/** A token valid by the console's clock for ten minutes: far outside the 30 s expiry buffer. */
function farExpiry(): number {
  return Date.now() + 10 * 60_000;
}

/** Ordered log of what happened, for the serialization assertions. */
let events: string[];

/** The `verbara-refresh` exclusivity of the real Web Locks API, shared by every "tab". */
function installFakeLocks(): void {
  let chain: Promise<unknown> = Promise.resolve();
  let holder = 0;
  const request = vi.fn(<T>(_name: string, cb: () => Promise<T>): Promise<T> => {
    const result = chain.then(async () => {
      const id = ++holder;
      events.push(`lock-acquired:${id}`);
      try {
        return await cb();
      } finally {
        events.push(`lock-released:${id}`);
      }
    });
    chain = result.catch(() => undefined);
    return result;
  });
  Object.defineProperty(globalThis.navigator, 'locks', {
    value: { request },
    configurable: true,
  });
}

function removeLocks(): void {
  Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
}

async function openTab(token: string): Promise<Tab> {
  vi.resetModules();
  const auth = await import('@/core/auth/auth-store');
  const client = await import('./client');
  auth.useAuthStore.getState().setAuth(token, farExpiry(), USER, 'tenant-1', [], {});
  return { client, auth };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authorizationOf(init: RequestInit | undefined): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

interface FakeServer {
  fetch: ReturnType<typeof vi.fn>;
  /** The `Authorization` of every stream request, in order. */
  streamAuth: (string | undefined)[];
  refreshCount: () => number;
}

/**
 * A Platform that rejects every token in `rejected` with 401 and answers 200 to any other one, and
 * mints `minted[0]`, `minted[1]`, … on successive refreshes. `stream` may override the stream answer.
 */
function fakeServer(options: {
  rejected: Set<string>;
  minted?: string[];
  stream?: (auth: string | undefined, n: number) => Promise<Response> | Response;
}): FakeServer {
  const minted = options.minted ?? ['new-token'];
  const streamAuth: (string | undefined)[] = [];
  let refreshes = 0;
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === REFRESH_URL) {
      const token = minted[refreshes] ?? `minted-${refreshes}`;
      refreshes += 1;
      events.push(`refresh:${token}`);
      // Rejecting the old token server-side is what re-minting means.
      return json({ accessToken: token, expiresAt: new Date(farExpiry()).toISOString() });
    }
    const auth = authorizationOf(init);
    streamAuth.push(auth);
    events.push(`stream:${auth ?? 'none'}`);
    if (options.stream) return options.stream(auth, streamAuth.length);
    const token = auth?.replace('Bearer ', '') ?? '';
    return options.rejected.has(token) ? json({}, 401) : json({ ok: true });
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, streamAuth, refreshCount: () => refreshes };
}

type Variant = 'customFetch' | 'customFetchWithHeaders';
const VARIANTS: Variant[] = ['customFetch', 'customFetchWithHeaders'];

function send(tab: Tab, variant: Variant): Promise<unknown> {
  const config = { url: STREAM_URL, method: 'GET' };
  return variant === 'customFetch'
    ? tab.client.customFetch(config)
    : tab.client.customFetchWithHeaders(config).then((r) => r.data);
}

beforeEach(() => {
  events = [];
  sessionStorage.clear();
  installFakeLocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  removeLocks();
});

describe.each(VARIANTS)('%s — a server 401 forces one real refresh', (variant) => {
  it('should_RefreshAndRetryWithADifferentToken_WhenTheServerRejectsALocallyValidToken', async () => {
    const tab = await openTab('t0');
    const server = fakeServer({ rejected: new Set(['t0']) });

    // Settled rather than awaited, so a failure reports which requests were made, not only the 401.
    const result = await send(tab, variant).catch((error: unknown) => error);

    expect({ refreshes: server.refreshCount(), streamAuth: server.streamAuth }).toEqual({
      refreshes: 1,
      streamAuth: ['Bearer t0', 'Bearer new-token'],
    });
    expect(server.streamAuth[1]).not.toBe(server.streamAuth[0]);
    expect(result).toEqual({ ok: true });
  });

  it('should_RetryWithTheHeldTokenWithoutARefresh_WhenAnEarlierCallInThisTabAlreadyReMinted', async () => {
    const tab = await openTab('t0');
    // The second request's 401 arrives only after the first one recovered.
    let releaseSecond: () => void = () => {};
    const secondAnswered = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const server = fakeServer({
      rejected: new Set(['t0']),
      stream: async (auth, n) => {
        if (n === 2) await secondAnswered;
        return auth === 'Bearer t0' ? json({}, 401) : json({ ok: true });
      },
    });

    const first = send(tab, variant);
    const second = send(tab, variant);
    await first;
    releaseSecond();
    await second;

    expect(server.refreshCount()).toBe(1);
    // first GET, second GET (both t0), first's retry, second's retry — both retries with the new token.
    expect(server.streamAuth).toEqual([
      'Bearer t0',
      'Bearer t0',
      'Bearer new-token',
      'Bearer new-token',
    ]);
  });

  it('should_FailWithTwoRequestsAndOneRefresh_WhenTheRetryIsRejectedToo', async () => {
    const tab = await openTab('t0');
    const server = fakeServer({ rejected: new Set(), stream: () => json({}, 401) });

    await expect(send(tab, variant)).rejects.toThrow('Unauthorized');

    expect(server.streamAuth).toHaveLength(2);
    expect(server.refreshCount()).toBe(1);
  });

  it('should_EndTheImpersonationWithoutARefresh_WhenARequestDuringItIsRejected', async () => {
    const tab = await openTab('operator-token');
    tab.auth.useAuthStore.getState().startImpersonation(
      {
        accessToken: 'imp-token',
        expiresAt: new Date(farExpiry()).toISOString(),
        targetTenantId: 'tenant-2',
        targetTenantName: 'Tenant 2',
      },
      'operator-token',
      'tenant-1',
    );
    const server = fakeServer({ rejected: new Set(['imp-token']) });

    await expect(send(tab, variant)).rejects.toBeInstanceOf(tab.client.ImpersonationEndedError);

    expect(server.refreshCount()).toBe(0);
    expect(server.streamAuth).toEqual(['Bearer imp-token']);
  });

  it('should_ShareOneRefresh_WhenTwoConcurrentRequestsInOneTabAreRejected', async () => {
    const tab = await openTab('t0');
    const server = fakeServer({ rejected: new Set(['t0']) });

    await Promise.all([send(tab, variant), send(tab, variant)]);

    expect(server.refreshCount()).toBe(1);
    expect(server.streamAuth.slice(2)).toEqual(['Bearer new-token', 'Bearer new-token']);
  });
});

describe('a server 401 — both fetch variants together', () => {
  it('should_ShareOneRefresh_WhenOneRequestOfEachVariantIsRejectedConcurrently', async () => {
    const tab = await openTab('t0');
    const server = fakeServer({ rejected: new Set(['t0']) });

    await Promise.all([send(tab, 'customFetch'), send(tab, 'customFetchWithHeaders')]);

    expect(server.refreshCount()).toBe(1);
    expect(server.streamAuth.slice(2)).toEqual(['Bearer new-token', 'Bearer new-token']);
  });
});

describe('a server 401 — two tabs', () => {
  it('should_RefreshOnceInEachTabSerialized_WhenBothTabsAreRejectedAtOnce', async () => {
    const tabA = await openTab('a0');
    const tabB = await openTab('b0');
    const server = fakeServer({ rejected: new Set(['a0', 'b0']), minted: ['a1', 'b1'] });

    const settled = await Promise.allSettled([
      send(tabA, 'customFetch'),
      send(tabB, 'customFetch'),
    ]);

    expect({ refreshes: server.refreshCount(), streamAuth: server.streamAuth }).toEqual({
      refreshes: 2,
      streamAuth: ['Bearer a0', 'Bearer b0', expect.any(String), expect.any(String)],
    });
    expect(settled.map((s) => s.status)).toEqual(['fulfilled', 'fulfilled']);
    // Each tab's retry carries the token its own refresh minted.
    expect(tabA.auth.useAuthStore.getState().accessToken).toBe('a1');
    expect(tabB.auth.useAuthStore.getState().accessToken).toBe('b1');
    expect(server.streamAuth.slice(2).sort()).toEqual(['Bearer a1', 'Bearer b1']);
    // The second refresh starts only after the lock holding the first was released.
    const firstRefresh = events.indexOf('refresh:a1');
    const secondRefresh = events.indexOf('refresh:b1');
    expect(firstRefresh).toBeGreaterThan(-1);
    expect(secondRefresh).toBeGreaterThan(firstRefresh);
    expect(events.slice(firstRefresh, secondRefresh)).toContain('lock-released:1');
  });
});

describe('refreshAccessToken — a forced call joining an unforced one', () => {
  it('should_IssueItsOwnForcedRefreshOnce_WhenTheSharedUnforcedCallKeptTheRejectedToken', async () => {
    const tab = await openTab('t0');
    const server = fakeServer({ rejected: new Set(['t0']) });

    // An unforced refresh (the pre-flight's form) finds t0 valid and makes no request; a forced call
    // for the rejected t0 joins it in flight, then re-mints on its own.
    const [unforced, forced] = await Promise.all([
      tab.client.refreshAccessToken(),
      tab.client.refreshAccessToken({ force: true, rejectedToken: 't0' }),
    ]);

    expect(unforced).toBe(true);
    expect(forced).toBe(true);
    expect(server.refreshCount()).toBe(1);
    expect(tab.auth.useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('should_KeepTheThirtySecondFastPath_WhenTheCallIsNotForced', async () => {
    const tab = await openTab('t0');
    const server = fakeServer({ rejected: new Set() });

    expect(await tab.client.refreshAccessToken()).toBe(true);

    expect(server.refreshCount()).toBe(0);
  });
});
