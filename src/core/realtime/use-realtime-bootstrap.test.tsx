import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';

/**
 * The bootstrap hook against the REAL hub (design D4, spec realtime-connection-lifecycle: "An
 * access-token refresh MUST NOT interrupt a healthy hub connection").
 *
 * `platform-hub` is the real module over the in-memory SignalR transport; its `startPlatformHub`
 * and `stopPlatformHub` are wrapped in spies (the real functions still run), so a test can count
 * the lifecycle calls the hook makes and still see what the connection does. Each test loads a
 * fresh module graph (see `load`), so no test inherits another's hub or stores.
 */
vi.mock('@microsoft/signalr', async (importOriginal) => {
  const { withInMemoryTransport } = await import('@/test/signalr-harness');
  return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
});

// No test here holds an expired token, so the refresh is never reached. The probe is stubbed to its
// no-verdict answer, so once a server-ended close triggers a session check (design D5) the hub stays
// `ended` and the session is left alone.
vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  refreshAccessToken: vi.fn(async () => false),
  probeSession: vi.fn(async () => 'unknown' as const),
}));

import { hubServer } from '@/test/signalr-harness';

const A_USER = { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'supervisor' } as const;
const B_USER = {
  id: 'user-2',
  email: 'b@b.com',
  displayName: 'Other',
  role: 'supervisor',
} as const;
const FIFTEEN_MINUTES = 15 * 60_000;

const SUPERVISION = {
  conversationId: 'conv-1',
  supervisorId: 'sup-1',
  mode: 'Listen',
  startedAt: '2026-10-02T12:00:00Z',
};

interface Loaded {
  hub: typeof import('@/core/realtime/platform-hub');
  bootstrap: typeof import('@/core/realtime/use-realtime-bootstrap');
  useRealtimeStore: (typeof import('@/core/stores/realtime-store'))['useRealtimeStore'];
  useAuthStore: (typeof import('@/core/auth/auth-store'))['useAuthStore'];
}

let loaded: Loaded | null = null;

async function load(): Promise<Loaded> {
  vi.resetModules();
  // `resetModules` keeps the mocks registry, so a hoisted `vi.mock` would hand every test the FIRST
  // graph's hub (and its stores). Registering the spy wrapper again here builds it over this graph's
  // real module.
  vi.doMock('@/core/realtime/platform-hub', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/core/realtime/platform-hub')>();
    return {
      ...actual,
      startPlatformHub: vi.fn(actual.startPlatformHub),
      stopPlatformHub: vi.fn(actual.stopPlatformHub),
    };
  });
  // Sequential on purpose: concurrent imports can evaluate the `platform-hub` mock factory twice,
  // and the hook would then hold different spies than the test.
  const hub = await import('@/core/realtime/platform-hub');
  const bootstrap = await import('@/core/realtime/use-realtime-bootstrap');
  const realtime = await import('@/core/stores/realtime-store');
  const auth = await import('@/core/auth/auth-store');
  loaded = {
    hub,
    bootstrap,
    useRealtimeStore: realtime.useRealtimeStore,
    useAuthStore: auth.useAuthStore,
  };
  return loaded;
}

/** Lets every pending microtask and zero-delay timer run (the harness never waits on a clock). */
async function settle(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Signs `user` in to `tenantId` with `token`, the realtime feature on. */
function signIn(
  m: Loaded,
  token: string,
  user: typeof A_USER | typeof B_USER = A_USER,
  tenantId = 'tenant-1',
) {
  m.useAuthStore.getState().setAuth(token, Date.now() + FIFTEEN_MINUTES, user, tenantId, [], {
    realtimePushSignalR: true,
  });
}

/** Applies a refreshed token for the SAME principal, exactly as `applyRefreshedToken` does. */
function rotate(m: Loaded, token: string) {
  const s = m.useAuthStore.getState();
  s.setAuth(token, Date.now() + FIFTEEN_MINUTES, s.user!, s.tenantId!, s.permissions, s.features);
}

/** Mounts the hook for a signed-in user and waits until the hub is connected. */
async function mountConnected(m: Loaded) {
  signIn(m, 'T1');
  const view = renderHook(() => m.bootstrap.useRealtimeBootstrap());
  await act(async () => {
    await settle();
  });
  expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
  vi.mocked(m.hub.startPlatformHub).mockClear();
  vi.mocked(m.hub.stopPlatformHub).mockClear();
  return view;
}

/** Applies an auth-store change inside `act` and lets the hub settle. */
async function change(apply: () => void) {
  await act(async () => {
    apply();
    await settle();
  });
}

/** The lifecycle calls made since the last clear, plus what the hub shows now. */
function snapshot(m: Loaded) {
  return {
    starts: vi.mocked(m.hub.startPlatformHub).mock.calls.length,
    stops: vi.mocked(m.hub.stopPlatformHub).mock.calls.length,
    connectionState: m.useRealtimeStore.getState().connectionState,
  };
}

const IMPERSONATION = {
  accessToken: 'IMP',
  expiresAt: new Date(Date.now() + FIFTEEN_MINUTES).toISOString(),
  targetTenantId: 'tenant-2',
  targetTenantName: 'Other tenant',
};

describe('useRealtimeBootstrap against the real hub', () => {
  beforeEach(() => {
    sessionStorage.clear();
    hubServer.reset();
  });

  afterEach(async () => {
    cleanup();
    if (loaded) {
      await loaded.hub.stopPlatformHub().catch(() => undefined);
      await settle();
      loaded.useAuthStore.getState().logout();
      loaded = null;
    }
    hubServer.reset();
  });

  // ── 4.2 (W3 regression): a token rotation must not restart a healthy hub ──

  it('UseRealtimeBootstrap_ShouldKeepTheHubAndItsState_WhenTheTokenRotatesTwiceForTheSamePrincipal', async () => {
    const m = await load();
    await mountConnected(m);
    act(() => m.useRealtimeStore.getState().setObservedSupervision(SUPERVISION));

    for (const token of ['T2', 'T3']) {
      await act(async () => {
        rotate(m, token);
        await settle();
      });

      expect({
        afterRotationTo: token,
        starts: vi.mocked(m.hub.startPlatformHub).mock.calls.length,
        stops: vi.mocked(m.hub.stopPlatformHub).mock.calls.length,
        connectionState: m.useRealtimeStore.getState().connectionState,
        observedSupervision: m.useRealtimeStore.getState().observedSupervision,
      }).toEqual({
        afterRotationTo: token,
        starts: 0,
        stops: 0,
        connectionState: 'connected',
        observedSupervision: SUPERVISION,
      });
    }
    // The one connection opened at sign-in is still the one in use.
    expect(hubServer.bearers).toEqual(['T1']);
  });

  // ── 4.5: the lifecycle restarts on a principal change ──

  it('UseRealtimeBootstrap_ShouldStartTheHubExactlyOnce_WhenMountedWithASession', async () => {
    const m = await load();
    signIn(m, 'T1');

    renderHook(() => m.bootstrap.useRealtimeBootstrap());
    await act(async () => {
      await settle();
    });

    // The lifecycle starts it; the revival sees that it was started for this very token.
    expect(snapshot(m)).toEqual({ starts: 1, stops: 0, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1']);
  });

  it('UseRealtimeBootstrap_ShouldMakeOneAttempt_WhenThePrincipalChangesWhileTheHubIsFailed', async () => {
    const m = await load();
    hubServer.negotiateStatus = 503;
    signIn(m, 'T1');
    renderHook(() => m.bootstrap.useRealtimeBootstrap());
    await act(async () => {
      await settle();
    });
    expect(m.useRealtimeStore.getState().connectionState).toBe('failed');
    vi.mocked(m.hub.startPlatformHub).mockClear();
    vi.mocked(m.hub.stopPlatformHub).mockClear();

    await change(() => signIn(m, 'T2', B_USER, 'tenant-1'));

    // The lifecycle's restart is the only attempt; the revival does not add a second one.
    expect(snapshot(m)).toEqual({ starts: 1, stops: 1, connectionState: 'failed' });
    expect(hubServer.bearers).toEqual(['T1', 'T2']);
  });

  it('UseRealtimeBootstrap_ShouldRestartTheHub_WhenAnotherUserSignsIn', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() => signIn(m, 'T2', B_USER, 'tenant-1'));

    expect(snapshot(m)).toEqual({ starts: 1, stops: 1, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1', 'T2']);
  });

  it('UseRealtimeBootstrap_ShouldRestartTheHub_WhenTheSameUserSignsInToAnotherTenant', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() => signIn(m, 'T2', A_USER, 'tenant-2'));

    expect(snapshot(m)).toEqual({ starts: 1, stops: 1, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1', 'T2']);
  });

  it('UseRealtimeBootstrap_ShouldStopTheHubAndNotStartIt_WhenTheUserSignsOut', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() => m.useAuthStore.getState().logout());

    expect(snapshot(m)).toMatchObject({ starts: 0, connectionState: 'disconnected' });
    expect(vi.mocked(m.hub.stopPlatformHub)).toHaveBeenCalled();
    expect(hubServer.transport.connected).toBe(false);
    expect(hubServer.bearers).toEqual(['T1']);
  });

  it('UseRealtimeBootstrap_ShouldRestartTheHubUnderTheImpersonationToken_WhenAnImpersonationStarts', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() =>
      m.useAuthStore.getState().startImpersonation(IMPERSONATION, 'T1', 'tenant-1'),
    );

    expect(snapshot(m)).toEqual({ starts: 1, stops: 1, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1', 'IMP']);
  });

  it('UseRealtimeBootstrap_ShouldRestartTheHub_WhenAnImpersonationKeepsTheSameTenant', async () => {
    const m = await load();
    await mountConnected(m);

    // Neither the user id nor the tenant id changes; only the impersonation flag does.
    await change(() =>
      m.useAuthStore
        .getState()
        .startImpersonation({ ...IMPERSONATION, targetTenantId: 'tenant-1' }, 'T1', 'tenant-1'),
    );

    expect(snapshot(m)).toEqual({ starts: 1, stops: 1, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1', 'IMP']);
  });

  it('UseRealtimeBootstrap_ShouldRestartTheHubUnderTheOperatorToken_WhenTheImpersonationEnds', async () => {
    const m = await load();
    await mountConnected(m);
    await change(() =>
      m.useAuthStore.getState().startImpersonation(IMPERSONATION, 'T1', 'tenant-1'),
    );
    vi.mocked(m.hub.startPlatformHub).mockClear();
    vi.mocked(m.hub.stopPlatformHub).mockClear();

    await change(() => m.useAuthStore.getState().endImpersonation());

    expect(snapshot(m)).toEqual({ starts: 1, stops: 1, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1', 'IMP', 'T1']);
  });

  it('UseRealtimeBootstrap_ShouldStopTheHub_WhenTheRealtimeFeatureTurnsOff', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() => m.useAuthStore.setState({ features: {} }));

    expect(snapshot(m)).toMatchObject({ starts: 0, connectionState: 'disconnected' });
    expect(vi.mocked(m.hub.stopPlatformHub)).toHaveBeenCalled();
    expect(hubServer.transport.connected).toBe(false);
  });

  it('UseRealtimeBootstrap_ShouldStopTheHub_WhenUnmounted', async () => {
    const m = await load();
    const view = await mountConnected(m);

    await act(async () => {
      view.unmount();
      await settle();
    });

    expect(snapshot(m)).toMatchObject({ starts: 0, connectionState: 'disconnected' });
    expect(hubServer.transport.connected).toBe(false);
  });

  it('UseRealtimeBootstrap_ShouldEndConnected_WhenMountedUnderStrictMode', async () => {
    const m = await load();
    signIn(m, 'T1');

    renderHook(() => m.bootstrap.useRealtimeBootstrap(), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });
    await act(async () => {
      await settle();
    });

    // Mount, simulated unmount, mount: start, stop, start, serialized.
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
    expect(hubServer.transport.connected).toBe(true);
  });

  // ── 4.5: the revival brings back a hub that is not connected and not trying to ──

  it('UseRealtimeBootstrap_ShouldReviveTheHubWithTheNewToken_WhenItFailedToStart', async () => {
    const m = await load();
    hubServer.negotiateStatus = 503;
    signIn(m, 'T1');
    renderHook(() => m.bootstrap.useRealtimeBootstrap());
    await act(async () => {
      await settle();
    });
    expect(m.useRealtimeStore.getState().connectionState).toBe('failed');
    hubServer.negotiateStatus = 200;
    vi.mocked(m.hub.startPlatformHub).mockClear();

    await change(() => rotate(m, 'T2'));

    expect(snapshot(m)).toEqual({ starts: 1, stops: 0, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1', 'T2']);
  });

  it('UseRealtimeBootstrap_ShouldReviveTheHubWithTheNewToken_WhenItsReconnectAttemptsRanOut', async () => {
    const m = await load();
    await mountConnected(m);
    hubServer.retryDelays = [0, 0, 0, 0];
    hubServer.negotiateStatus = 503;
    act(() => hubServer.dropTransport());
    await vi.waitFor(() =>
      expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected'),
    );
    hubServer.negotiateStatus = 200;
    const negotiationsBefore = hubServer.negotiations.length;

    await change(() => rotate(m, 'T2'));

    expect(snapshot(m)).toEqual({ starts: 1, stops: 0, connectionState: 'connected' });
    expect(hubServer.bearers.slice(negotiationsBefore)).toEqual(['T2']);
  });

  it('UseRealtimeBootstrap_ShouldReviveTheHubWithTheNewToken_WhenTheHubEnded', async () => {
    const m = await load();
    await mountConnected(m);
    // The server closed the hub without allowing a reconnect (the revocation's bare frame).
    act(() => hubServer.pushRevocation());
    await vi.waitFor(() =>
      expect(['disconnected', 'ended']).toContain(m.useRealtimeStore.getState().connectionState),
    );
    // `ended` is what design D5 files that close as; set it here so this test pins the revival
    // rule on its own, whichever close classification is in place.
    act(() => m.useRealtimeStore.getState().setConnectionState('ended'));
    vi.mocked(m.hub.startPlatformHub).mockClear();

    await change(() => rotate(m, 'T2'));

    expect(snapshot(m)).toEqual({ starts: 1, stops: 0, connectionState: 'connected' });
    expect(hubServer.bearers).toEqual(['T1', 'T2']);
  });

  it('UseRealtimeBootstrap_ShouldNotStartTheHub_WhenTheTokenRotatesWhileTheLibraryIsReconnecting', async () => {
    const m = await load();
    await mountConnected(m);
    hubServer.retryDelays = [60_000];
    act(() => hubServer.dropTransport());
    await vi.waitFor(() =>
      expect(m.useRealtimeStore.getState().connectionState).toBe('reconnecting'),
    );

    await change(() => rotate(m, 'T2'));

    expect(snapshot(m)).toEqual({ starts: 0, stops: 0, connectionState: 'reconnecting' });
    expect(hubServer.bearers).toEqual(['T1']);
  });
});
