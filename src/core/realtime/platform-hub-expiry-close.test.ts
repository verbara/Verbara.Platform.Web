import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The expiry close (spec realtime-connection-lifecycle: "A server close that allows a reconnect
 * MUST reconnect with a current token"; design D4). Since v2.24.0 Platform closes every admitted
 * hub connection at its token's `exp` with `{"type":7,"allowReconnect":true}`, and the library
 * reconnects. Every (re)connect must present the token the console holds at that moment, and when
 * that token has already expired it must refresh first.
 *
 * The expired-token case is the PRIMARY one: the proactive refresh is a no-op under Web Locks, so
 * on a page that made no API call in the token's last 30 s the token has expired by the time the
 * close arrives. Both cases run the REAL `@microsoft/signalr` client over the in-memory transport,
 * under fake timers (Date included), with `refreshAccessToken` mocked.
 */
vi.mock('@microsoft/signalr', async (importOriginal) => {
  const { withInMemoryTransport } = await import('@/test/signalr-harness');
  return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
});

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  refreshAccessToken: vi.fn(async () => false),
}));

import { hubServer } from '@/test/signalr-harness';

const A_USER = { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'supervisor' } as const;
const FIFTEEN_MINUTES = 15 * 60_000;

interface Loaded {
  hub: typeof import('@/core/realtime/platform-hub');
  refreshAccessToken: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  useRealtimeStore: (typeof import('@/core/stores/realtime-store'))['useRealtimeStore'];
  useAuthStore: (typeof import('@/core/auth/auth-store'))['useAuthStore'];
  /** Every realtime connection state the store passed through, in order. */
  states: string[];
}

let loaded: Loaded | null = null;
let unsubscribe: (() => void) | null = null;

async function load(): Promise<Loaded> {
  vi.resetModules();
  // Sequential on purpose: concurrent imports can evaluate a mock factory twice.
  const hub = await import('@/core/realtime/platform-hub');
  const client = await import('@/core/api/client');
  const realtime = await import('@/core/stores/realtime-store');
  const auth = await import('@/core/auth/auth-store');
  const states: string[] = [];
  unsubscribe = realtime.useRealtimeStore.subscribe((s, prev) => {
    if (s.connectionState !== prev.connectionState) states.push(s.connectionState);
  });
  loaded = {
    hub,
    refreshAccessToken: vi.mocked(client.refreshAccessToken),
    useRealtimeStore: realtime.useRealtimeStore,
    useAuthStore: auth.useAuthStore,
    states,
  };
  loaded.refreshAccessToken.mockReset();
  loaded.refreshAccessToken.mockResolvedValue(false);
  return loaded;
}

function setToken(m: Loaded, token: string) {
  m.useAuthStore.getState().setAuth(token, Date.now() + FIFTEEN_MINUTES, A_USER, 'tenant-1', [], {
    realtimePushSignalR: true,
  });
}

/** A promise the test resolves by hand, to hold the refresh open and observe what waits on it. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Connects the hub with T1 and clears the state log. */
async function connectWithT1(m: Loaded) {
  setToken(m, 'T1');
  await m.hub.startPlatformHub();
  expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
  expect(hubServer.bearers).toEqual(['T1']);
  m.states.length = 0;
}

describe('platform-hub expiry close', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    hubServer.reset();
  });

  afterEach(async () => {
    unsubscribe?.();
    unsubscribe = null;
    if (loaded) {
      hubServer.retryDelays = [0, 0, 0, 0];
      await loaded.hub.stopPlatformHub().catch(() => undefined);
      await vi.runOnlyPendingTimersAsync();
      loaded.useAuthStore.getState().logout();
      loaded = null;
    }
    vi.useRealTimers();
    hubServer.reset();
  });

  // ── Primary: the held token has expired when the close arrives ──

  it('ExpiryClose_ShouldRefreshBeforeNegotiatingAndPresentTheRefreshedToken_WhenTheHeldTokenHasExpired', async () => {
    const m = await load();
    await connectWithT1(m);

    // A quiet page: no API call rotated the token, so it is past its 30 s expiry buffer.
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES - 20_000);
    expect(m.useAuthStore.getState().isTokenExpired()).toBe(true);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');

    const gate = deferred();
    m.refreshAccessToken.mockImplementation(async () => {
      await gate.promise;
      setToken(m, 'T3');
      return true;
    });

    hubServer.pushExpiryClose();
    await vi.advanceTimersByTimeAsync(0);

    // The reconnect waits on the refresh: nothing has been negotiated with the expired T1.
    expect(m.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(hubServer.bearers).toEqual(['T1']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('reconnecting');

    gate.resolve();
    await vi.waitFor(() => expect(m.useRealtimeStore.getState().connectionState).toBe('connected'));

    expect(hubServer.bearers).toEqual(['T1', 'T3']);
    expect(m.states).toEqual(['reconnecting', 'connected']);
    expect(m.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  // ── A customFetch pre-flight already rotated the token ──

  it('ExpiryClose_ShouldPresentTheHeldTokenWithoutRefreshing_WhenThatTokenIsStillValid', async () => {
    const m = await load();
    await connectWithT1(m);
    setToken(m, 'T2');

    hubServer.pushExpiryClose();
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(m.useRealtimeStore.getState().connectionState).toBe('connected'));

    expect(m.refreshAccessToken).not.toHaveBeenCalled();
    expect(hubServer.bearers).toEqual(['T1', 'T2']);
    expect(m.states).toEqual(['reconnecting', 'connected']);
  });

  // ── The token factory never presents a token it knows is stale ──

  it('ExpiryClose_ShouldFailEachAttemptWithoutNegotiating_WhenTheRefreshOfAnExpiredTokenFails', async () => {
    const m = await load();
    await connectWithT1(m);
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES - 20_000);
    hubServer.retryDelays = [0, 0, 0, 0];
    m.refreshAccessToken.mockResolvedValue(false);

    hubServer.pushExpiryClose();
    await vi.waitFor(() =>
      expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected'),
    );

    // Every attempt asked for a refresh, was refused, and never reached negotiate with T1.
    expect(m.refreshAccessToken).toHaveBeenCalledTimes(4);
    expect(hubServer.bearers).toEqual(['T1']);
    expect(m.states).toEqual(['reconnecting', 'disconnected']);
  });

  it('ExpiryClose_ShouldPresentTheImpersonationTokenWithoutRefreshing_WhenAnImpersonationIsActive', async () => {
    const m = await load();
    setToken(m, 'T1');
    m.useAuthStore.getState().startImpersonation(
      {
        accessToken: 'IMP',
        expiresAt: new Date(Date.now() + FIFTEEN_MINUTES).toISOString(),
        targetTenantId: 'tenant-2',
        targetTenantName: 'Other tenant',
      },
      'T1',
      'tenant-1',
    );
    await m.hub.startPlatformHub();
    expect(hubServer.bearers).toEqual(['IMP']);
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES - 20_000);
    expect(m.useAuthStore.getState().isTokenExpired()).toBe(true);

    hubServer.pushExpiryClose();
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(m.useRealtimeStore.getState().connectionState).toBe('connected'));

    // The refresh cookie is the operator's: refreshing would install the operator's token next to
    // the impersonated tenant. The held impersonation token is presented as is.
    expect(m.refreshAccessToken).not.toHaveBeenCalled();
    expect(hubServer.bearers).toEqual(['IMP', 'IMP']);
    expect(m.useAuthStore.getState().accessToken).toBe('IMP');
  });

  it('StartPlatformHub_ShouldFailWithoutNegotiating_WhenThereIsNoAccessToken', async () => {
    const m = await load();

    await expect(m.hub.startPlatformHub()).rejects.toThrow();

    expect(m.refreshAccessToken).not.toHaveBeenCalled();
    expect(hubServer.negotiations).toHaveLength(0);
    expect(m.useRealtimeStore.getState().connectionState).toBe('failed');
  });
});
