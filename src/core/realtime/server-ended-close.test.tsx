import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

/**
 * A server close that forbids a reconnect (design D5, spec realtime-connection-lifecycle: "A server
 * close that forbids a reconnect MUST be resolved against the session").
 *
 * Every test mounts the app's own `useRealtimeBootstrap` over the REAL `platform-hub` and the REAL
 * `@microsoft/signalr` `HubConnection`, through the in-memory transport of `@/test/signalr-harness`.
 * Each frame pushed is one Platform actually sends: the revocation's bare `{"type":7}` (`Abort()`),
 * and the refusal's `{"type":7,"error":"…"}` (a `HubException` from `OnConnectedAsync`).
 *
 * Only the session probe and the agent teardown are mocked: the probe because its HTTP behaviour is
 * pinned in `probe-session.test.ts`, the teardown because it is pinned in `agent-teardown.test.ts`.
 * `platform-hub`'s start and stop are wrapped in pass-through spies, so a test counts the restarts
 * the hook asks for and still sees what the connection does. Each test loads a fresh module graph.
 */
vi.mock('@microsoft/signalr', async (importOriginal) => {
  const { withInMemoryTransport } = await import('@/test/signalr-harness');
  return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
});

import { hubServer } from '@/test/signalr-harness';
import type { SessionProbeResult } from '@/core/api/client';

const A_USER = { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'supervisor' } as const;
const B_USER = {
  id: 'user-2',
  email: 'b@b.com',
  displayName: 'Other',
  role: 'supervisor',
} as const;
const FIFTEEN_MINUTES = 15 * 60_000;
const REFUSAL = 'Connection closed with an error. HubException: Account is not active.';
const SESSION_ENDED_LOGIN = '/login?reason=session-ended';

const IMPERSONATION = {
  accessToken: 'IMP',
  expiresAt: new Date(Date.now() + FIFTEEN_MINUTES).toISOString(),
  targetTenantId: 'tenant-2',
  targetTenantName: 'Other tenant',
};

interface Loaded {
  hub: typeof import('@/core/realtime/platform-hub');
  bootstrap: typeof import('@/core/realtime/use-realtime-bootstrap');
  presence: typeof import('@/core/realtime/use-realtime-presence');
  probeSession: ReturnType<typeof vi.fn<() => Promise<SessionProbeResult>>>;
  safeAgentTeardown: ReturnType<
    typeof vi.fn<(typeof import('@/core/session/agent-teardown'))['safeAgentTeardown']>
  >;
  queryClient: (typeof import('@/core/api/query-client'))['queryClient'];
  useRealtimeStore: (typeof import('@/core/stores/realtime-store'))['useRealtimeStore'];
  useAuthStore: (typeof import('@/core/auth/auth-store'))['useAuthStore'];
}

let loaded: Loaded | null = null;

/**
 * One ordered log of the side effects that matter to the sign-out: the teardown, the session being
 * cleared, and the page navigation. The location stub writes `navigate:<href>` into it.
 */
const log: string[] = [];
/** Every URL handed to `fetch`, so a test can prove no `/api/v1/auth/refresh` was issued. */
const fetchedUrls: string[] = [];
let originalLocation: PropertyDescriptor | undefined;

async function load(): Promise<Loaded> {
  vi.resetModules();
  // `resetModules` keeps the mocks registry, so each mock is registered again here and built over
  // THIS graph's real modules (a hoisted mock would hand every test the first graph's instances).
  vi.doMock('@/core/api/client', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/core/api/client')>()),
    probeSession: vi.fn(async (): Promise<SessionProbeResult> => 'unknown'),
  }));
  vi.doMock('@/core/session/agent-teardown', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/core/session/agent-teardown')>()),
    safeAgentTeardown: vi.fn(async () => undefined),
  }));
  vi.doMock('@/core/realtime/platform-hub', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/core/realtime/platform-hub')>();
    return {
      ...actual,
      startPlatformHub: vi.fn(actual.startPlatformHub),
      stopPlatformHub: vi.fn(actual.stopPlatformHub),
    };
  });
  // Sequential on purpose: concurrent imports can evaluate a mock factory twice, and the hook would
  // then hold different spies than the test.
  const hub = await import('@/core/realtime/platform-hub');
  const bootstrap = await import('@/core/realtime/use-realtime-bootstrap');
  const presence = await import('@/core/realtime/use-realtime-presence');
  const client = await import('@/core/api/client');
  const teardown = await import('@/core/session/agent-teardown');
  const { queryClient } = await import('@/core/api/query-client');
  const realtime = await import('@/core/stores/realtime-store');
  const auth = await import('@/core/auth/auth-store');
  loaded = {
    hub,
    bootstrap,
    presence,
    probeSession: vi.mocked(client.probeSession),
    safeAgentTeardown: vi.mocked(teardown.safeAgentTeardown),
    queryClient,
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

/** An impersonation of the tenant the operator is already in: only the impersonation flag flips. */
const SAME_TENANT_IMPERSONATION = { ...IMPERSONATION, targetTenantId: 'tenant-1' };

/** Applies a refreshed token for the SAME principal, exactly as `applyRefreshedToken` does. */
function rotate(m: Loaded, token: string) {
  const s = m.useAuthStore.getState();
  s.setAuth(token, Date.now() + FIFTEEN_MINUTES, s.user!, s.tenantId!, s.permissions, s.features);
}

/**
 * Signs in with T1, mounts the bootstrap hook (plus a presence subscriber when asked) and waits
 * until the hub is connected. Then clears the lifecycle spies.
 */
async function mountConnected(m: Loaded, options: { withPresenceSubscriber?: boolean } = {}) {
  signIn(m, 'T1');
  const view = renderHook(() => {
    m.bootstrap.useRealtimeBootstrap();
    if (options.withPresenceSubscriber) m.presence.useRealtimePresence('agent-1');
  });
  await act(async () => {
    await settle();
  });
  expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
  vi.mocked(m.hub.startPlatformHub).mockClear();
  vi.mocked(m.hub.stopPlatformHub).mockClear();
  return view;
}

/** Runs `apply` inside `act` and lets the hub, the probe and the hook settle. */
async function change(apply: () => void) {
  await act(async () => {
    apply();
    await settle();
  });
}

/** The negotiate bearers recorded since `from` (an index into `hubServer.negotiations`). */
function bearersSince(from: number): (string | null)[] {
  return hubServer.bearers.slice(from);
}

function starts(m: Loaded): number {
  return vi.mocked(m.hub.startPlatformHub).mock.calls.length;
}

/** What the real probe does on a 200 outside an impersonation: apply the token, then answer. */
function probeActiveRotatingTo(m: Loaded, token: string) {
  return async (): Promise<SessionProbeResult> => {
    rotate(m, token);
    return 'active';
  };
}

describe('a server close that forbids a reconnect', () => {
  beforeEach(() => {
    sessionStorage.clear();
    hubServer.reset();
    log.length = 0;
    fetchedUrls.length = 0;

    // Record navigations instead of letting jsdom attempt them. `href` keeps answering the page's
    // own URL, because the harness resolves `/hubs/platform` against it.
    originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
    const { origin, href } = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        origin,
        set href(value: string) {
          log.push(`navigate:${value}`);
        },
        get href() {
          return href;
        },
      },
    });

    // No test should reach the network; record any attempt (a refresh would be one).
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        fetchedUrls.push(String(input));
        return new Response(null, { status: 401 });
      }),
    );
  });

  afterEach(async () => {
    cleanup();
    if (loaded) {
      await loaded.hub.stopPlatformHub().catch(() => undefined);
      await settle();
      loaded.useAuthStore.getState().logout();
      loaded = null;
    }
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
    vi.unstubAllGlobals();
    hubServer.reset();
  });

  // ── Classification: which closes are server-ended ──

  it('OnClose_ShouldEndTheHubAndProbeOnce_WhenTheServerSendsTheBareRevocationFrame', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() => hubServer.pushRevocation());

    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  it('OnClose_ShouldEndTheHubAndProbeOnce_WhenTheServerRefusesAnEstablishedConnection', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() => hubServer.pushRefusal(REFUSAL));

    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  it('OnClose_ShouldEndTheHub_WhenTheServerRefusesTheConnectionAfterASuccessfulReconnect', async () => {
    const m = await load();
    await mountConnected(m);
    const states: string[] = [];
    const unsubscribe = m.useRealtimeStore.subscribe((s, prev) => {
      if (s.connectionState !== prev.connectionState) states.push(s.connectionState);
    });

    // The transport drops and the library's first (immediate) retry gets back in.
    await change(() => hubServer.dropTransport());
    expect(states).toEqual(['reconnecting', 'connected']);

    await change(() => hubServer.pushRefusal(REFUSAL));
    unsubscribe();

    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  it('OnClose_ShouldEndTheHub_WhenTheServerRefusesTheReconnectInTheSameReceiveAsTheHandshake', async () => {
    const m = await load();
    await mountConnected(m);
    // The reconnect is admitted to the handshake and refused in the same receive.
    hubServer.queueHandshake({ kind: 'close', close: { error: REFUSAL } });

    await change(() => hubServer.dropTransport());

    expect(hubServer.bearers).toEqual(['T1', 'T1']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  it('OnClose_ShouldEndTheHub_WhenTheServerRevokesAConnectionThatReconnectedAtTokenExpiry', async () => {
    const m = await load();
    await mountConnected(m);
    // Every connection older than one token period has been through Platform's expiry close.
    await change(() => hubServer.pushExpiryClose());
    expect(hubServer.bearers).toEqual(['T1', 'T1']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');

    await change(() => hubServer.pushRevocation());

    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  it('OnClose_ShouldReportDisconnectedWithoutProbing_WhenTheReconnectAttemptsRunOut', async () => {
    const m = await load();
    await mountConnected(m);
    hubServer.retryDelays = [0, 0, 0, 0];
    hubServer.negotiateStatus = 503;

    await change(() => hubServer.dropTransport());
    await vi.waitFor(() =>
      expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected'),
    );
    await act(async () => {
      await settle();
    });

    // 1 + 4 negotiations: the connect, then every retry refused.
    expect(hubServer.negotiations).toHaveLength(5);
    expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected');
    expect(m.probeSession).not.toHaveBeenCalled();
  });

  it('OnClose_ShouldEndTheHub_WhenTheServerRevokesAConnectionRevivedAfterItsRetriesRanOut', async () => {
    const m = await load();
    await mountConnected(m);
    hubServer.retryDelays = [0, 0, 0, 0];
    hubServer.negotiateStatus = 503;
    await change(() => hubServer.dropTransport());
    await vi.waitFor(() =>
      expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected'),
    );
    hubServer.negotiateStatus = 200;
    await change(() => rotate(m, 'T2'));
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');

    // The revived connection's first close must not inherit the earlier reconnect loop.
    await change(() => hubServer.pushRevocation());

    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  it('OnClose_ShouldEndTheHubAndProbe_WhenAStopOnAnAlreadyDisconnectedHubPrecededTheNextSession', async () => {
    const m = await load();
    hubServer.negotiateStatus = 503;
    signIn(m, 'T1');
    renderHook(() => m.bootstrap.useRealtimeBootstrap());
    await act(async () => {
      await settle();
    });
    expect(m.useRealtimeStore.getState().connectionState).toBe('failed');
    hubServer.negotiateStatus = 200;

    // A sign-out stops a hub that is already `Disconnected`; then the next session connects.
    await change(() => m.useAuthStore.getState().logout());
    await change(() => signIn(m, 'T2'));
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');

    // That session's first server close must not be filed as the earlier requested stop.
    await change(() => hubServer.pushRevocation());

    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  // ── Reaction: the session probe decides ──

  it('ServerEndedClose_ShouldTearDownThenSignOutThenOpenTheSessionEndedLogin_WhenTheProbeSaysEnded', async () => {
    const m = await load();
    await mountConnected(m);
    m.probeSession.mockResolvedValue('ended');
    let finishTeardown!: () => void;
    m.safeAgentTeardown.mockImplementation(() => {
      log.push('teardown');
      return new Promise<void>((resolve) => {
        finishTeardown = resolve;
      });
    });
    const unsubscribe = m.useAuthStore.subscribe((s, prev) => {
      if (prev.accessToken && !s.accessToken) log.push('logout');
    });

    await change(() => hubServer.pushRevocation());

    // The agent teardown runs first, with the app's shared query client, and the sign-out waits.
    // Identity, not equality: every QueryClient keeps its state in private fields, so
    // `toHaveBeenCalledWith` would accept any instance, including an empty one whose ['agent-me']
    // cache would make the teardown skip the offline write.
    expect(m.safeAgentTeardown).toHaveBeenCalledTimes(1);
    expect(m.safeAgentTeardown.mock.calls[0]![0]).toBe(m.queryClient);
    expect(log).toEqual(['teardown']);
    expect(m.useAuthStore.getState().accessToken).toBe('T1');

    await change(() => finishTeardown());
    unsubscribe();

    expect(log).toEqual(['teardown', 'logout', `navigate:${SESSION_ENDED_LOGIN}`]);
    expect(m.useAuthStore.getState().accessToken).toBeNull();
    expect(m.probeSession).toHaveBeenCalledTimes(1);
    // The sign-out reconnects nothing.
    expect(hubServer.bearers).toEqual(['T1']);
  });

  it('ServerEndedClose_ShouldRestartTheHubExactlyOnce_WhenTheProbeSaysActive', async () => {
    const m = await load();
    await mountConnected(m);
    // Hold the probe open, to apply its refreshed token BEFORE its verdict lands (the real probe
    // applies the token first, and React may re-render in between).
    let verdict!: (result: SessionProbeResult) => void;
    m.probeSession.mockImplementationOnce(
      () =>
        new Promise<SessionProbeResult>((resolve) => {
          verdict = resolve;
        }),
    );
    const negotiationsBefore = hubServer.negotiations.length;

    await change(() => hubServer.pushRevocation());
    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);

    // The refreshed token lands while the check is still in flight: nothing starts yet.
    await change(() => rotate(m, 'T2'));
    expect(starts(m)).toBe(0);
    expect(bearersSince(negotiationsBefore)).toEqual([]);

    await change(() => verdict('active'));

    expect(starts(m)).toBe(1);
    expect(bearersSince(negotiationsBefore)).toEqual(['T2']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');

    // The single reconnect is closed the same way while T2 is still current: it stays `ended`.
    await change(() => hubServer.pushRevocation());

    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
    expect(starts(m)).toBe(1);
    expect(bearersSince(negotiationsBefore)).toEqual(['T2']);
  });

  it('ServerEndedClose_ShouldMakeASingleAttempt_WhenTheRestartAfterAnActiveProbeIsRefused', async () => {
    const m = await load();
    await mountConnected(m);
    m.probeSession.mockImplementationOnce(probeActiveRotatingTo(m, 'T2'));
    const negotiationsBefore = hubServer.negotiations.length;
    hubServer.negotiateStatus = 503;

    await change(() => hubServer.pushRevocation());
    await act(async () => {
      await settle();
    });

    // The one restart was refused; the token the probe applied does not buy a second attempt.
    expect(bearersSince(negotiationsBefore)).toEqual(['T2']);
    expect(starts(m)).toBe(1);
    expect(m.useRealtimeStore.getState().connectionState).toBe('failed');
  });

  it('ServerEndedClose_ShouldCheckTheSessionAgain_AfterTheNextTokenRefreshRevivedTheHub', async () => {
    const m = await load();
    await mountConnected(m);
    m.probeSession.mockImplementationOnce(probeActiveRotatingTo(m, 'T2'));
    await change(() => hubServer.pushRevocation());
    await change(() => hubServer.pushRevocation());
    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);

    // The next refresh revives the hub (design D4), and its next server-ended close is checked.
    await change(() => rotate(m, 'T3'));
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
    await change(() => hubServer.pushRevocation());

    expect(hubServer.bearers).toEqual(['T1', 'T2', 'T3']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(2);
  });

  it('ServerEndedClose_ShouldKeepTheSessionAndStayEnded_WhenTheProbeHasNoVerdict', async () => {
    const m = await load();
    await mountConnected(m);
    m.probeSession.mockResolvedValue('unknown');

    await change(() => hubServer.pushRevocation());

    expect(m.probeSession).toHaveBeenCalledTimes(1);
    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.useAuthStore.getState().accessToken).toBe('T1');
    expect(m.safeAgentTeardown).not.toHaveBeenCalled();
    expect(log).toEqual([]);
    expect(starts(m)).toBe(0);
    expect(hubServer.bearers).toEqual(['T1']);
  });

  it('ServerEndedClose_ShouldDropTheVerdict_WhenTheUserSignedOutWhileTheCheckWasInFlight', async () => {
    const m = await load();
    await mountConnected(m);
    let verdict!: (result: SessionProbeResult) => void;
    m.probeSession.mockImplementationOnce(
      () =>
        new Promise<SessionProbeResult>((resolve) => {
          verdict = resolve;
        }),
    );
    await change(() => hubServer.pushRevocation());
    expect(m.probeSession).toHaveBeenCalledTimes(1);

    await change(() => m.useAuthStore.getState().logout());
    await change(() => verdict('ended'));

    // The user's own sign-out already handled the session; the late verdict adds nothing.
    expect(m.safeAgentTeardown).not.toHaveBeenCalled();
    expect(log).toEqual([]);
    expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected');
  });

  it('ServerEndedClose_ShouldCheckTheNewPrincipalsSession_WhileAnEarlierPrincipalsCheckIsStillInFlight', async () => {
    const m = await load();
    await mountConnected(m);
    const verdicts: ((result: SessionProbeResult) => void)[] = [];
    m.probeSession.mockImplementation(
      () =>
        new Promise<SessionProbeResult>((resolve) => {
          verdicts.push(resolve);
        }),
    );
    await change(() => hubServer.pushRevocation());
    expect(m.probeSession).toHaveBeenCalledTimes(1);

    // The principal changes while that check is still open; the new connection is then ended.
    await change(() =>
      m.useAuthStore.getState().startImpersonation(IMPERSONATION, 'T1', 'tenant-1'),
    );
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
    vi.mocked(m.hub.startPlatformHub).mockClear();
    await change(() => hubServer.pushRevocation());
    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(2);

    // The earlier principal's verdict lands and is dropped; the new check is still the one in
    // charge, so a token landing now does not revive the hub ahead of its verdict.
    await change(() => verdicts[0]!('active'));
    await change(() => m.useAuthStore.setState({ accessToken: 'IMP-2' }));
    expect(starts(m)).toBe(0);

    await change(() => verdicts[1]!('active'));

    expect(starts(m)).toBe(1);
    expect(hubServer.bearers).toEqual(['T1', 'IMP', 'IMP-2']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
  });

  // One case per part of the session check's principal key, each changing that part ALONE: a
  // verdict about the previous principal must neither restart the new principal's hub nor spend
  // its single restart (which would leave its next server-ended close unchecked).
  it.each<[string, { before?: (m: Loaded) => void; apply: (m: Loaded) => void; token: string }]>([
    [
      'AnImpersonationOfTheSameTenantStarts',
      {
        apply: (m) =>
          m.useAuthStore.getState().startImpersonation(SAME_TENANT_IMPERSONATION, 'T1', 'tenant-1'),
        token: 'IMP',
      },
    ],
    [
      'AnImpersonationOfTheSameTenantEnds',
      {
        before: (m) =>
          m.useAuthStore.getState().startImpersonation(SAME_TENANT_IMPERSONATION, 'T1', 'tenant-1'),
        apply: (m) => m.useAuthStore.getState().endImpersonation(),
        token: 'T1',
      },
    ],
    [
      'TheSameUserSwitchesTenant',
      { apply: (m) => signIn(m, 'T2', A_USER, 'tenant-2'), token: 'T2' },
    ],
    [
      'AnotherUserSignsInToTheSameTenant',
      { apply: (m) => signIn(m, 'T2', B_USER, 'tenant-1'), token: 'T2' },
    ],
  ])(
    'ServerEndedClose_ShouldDropTheEarlierPrincipalsVerdict_When%s',
    async (_change, { before, apply, token }) => {
      const m = await load();
      await mountConnected(m);
      if (before) await change(() => before(m));
      const verdicts: ((result: SessionProbeResult) => void)[] = [];
      m.probeSession.mockImplementation(
        () =>
          new Promise<SessionProbeResult>((resolve) => {
            verdicts.push(resolve);
          }),
      );
      await change(() => hubServer.pushRevocation());
      expect(m.probeSession).toHaveBeenCalledTimes(1);

      // Only this one part of the principal changes while the check is in flight; the lifecycle
      // restarts the hub for the new principal.
      await change(() => apply(m));
      expect(m.useAuthStore.getState().accessToken).toBe(token);
      expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
      vi.mocked(m.hub.startPlatformHub).mockClear();
      const negotiationsBefore = hubServer.negotiations.length;

      // The previous principal's verdict lands: no restart.
      await change(() => verdicts[0]!('active'));
      expect(starts(m)).toBe(0);
      expect(bearersSince(negotiationsBefore)).toEqual([]);

      // The new principal's single restart is still unspent: its first server-ended close is
      // checked.
      await change(() => hubServer.pushRevocation());
      expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
      expect(m.probeSession).toHaveBeenCalledTimes(2);
    },
  );

  it('Revival_ShouldNotWaitForAnEarlierPrincipalsCheck_WhenTheNewPrincipalsHubFailedToStart', async () => {
    const m = await load();
    await mountConnected(m);
    m.probeSession.mockImplementationOnce(() => new Promise<SessionProbeResult>(() => undefined));
    await change(() => hubServer.pushRevocation());
    expect(m.probeSession).toHaveBeenCalledTimes(1);

    // The principal changes while that check never answers, and the new hub fails to start.
    hubServer.negotiateStatus = 503;
    await change(() =>
      m.useAuthStore.getState().startImpersonation(IMPERSONATION, 'T1', 'tenant-1'),
    );
    expect(m.useRealtimeStore.getState().connectionState).toBe('failed');
    hubServer.negotiateStatus = 200;
    vi.mocked(m.hub.startPlatformHub).mockClear();

    // The void check does not hold up the revival at the next token.
    await change(() => m.useAuthStore.setState({ accessToken: 'IMP-2' }));

    expect(starts(m)).toBe(1);
    expect(hubServer.bearers).toEqual(['T1', 'IMP', 'IMP-2']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
  });

  it('SignOut_ShouldNotCheckTheSession_WhenTheUserSignsOut', async () => {
    const m = await load();
    await mountConnected(m);

    await change(() => m.useAuthStore.getState().logout());

    expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected');
    expect(m.probeSession).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it('Restart_ShouldNotCheckTheSession_WhenThePrincipalChangeStopsTheHub', async () => {
    const m = await load();
    await mountConnected(m);

    // The lifecycle stops and restarts the hub; the close of that stop is a requested one.
    await change(() =>
      m.useAuthStore.getState().startImpersonation(IMPERSONATION, 'T1', 'tenant-1'),
    );

    expect(hubServer.bearers).toEqual(['T1', 'IMP']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
    expect(m.probeSession).not.toHaveBeenCalled();
  });

  it('ServerEndedClose_ShouldRestartUnderTheImpersonationToken_WhenTheProbeSaysActiveDuringAnImpersonation', async () => {
    const m = await load();
    await mountConnected(m);
    await change(() =>
      m.useAuthStore.getState().startImpersonation(IMPERSONATION, 'T1', 'tenant-1'),
    );
    expect(hubServer.bearers).toEqual(['T1', 'IMP']);
    vi.mocked(m.hub.startPlatformHub).mockClear();
    // During an impersonation the real probe answers without replacing the token.
    m.probeSession.mockResolvedValue('active');

    await change(() => hubServer.pushRevocation());

    expect(starts(m)).toBe(1);
    expect(hubServer.bearers).toEqual(['T1', 'IMP', 'IMP']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
    expect(m.useAuthStore.getState().impersonation?.active).toBe(true);
    expect(m.useAuthStore.getState().accessToken).toBe('IMP');
  });

  // ── With a page subscribed to the hub for the whole test ──

  it('ServerEndedClose_ShouldNegotiateExactlyOnce_WhenAPresenceSubscriberIsMountedAndTheProbeSaysActive', async () => {
    const m = await load();
    await mountConnected(m, { withPresenceSubscriber: true });
    m.probeSession.mockImplementationOnce(probeActiveRotatingTo(m, 'T2'));
    const negotiationsBefore = hubServer.negotiations.length;

    await change(() => hubServer.pushRevocation());

    expect(bearersSince(negotiationsBefore)).toEqual(['T2']);
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
    // The page re-subscribed on the restarted connection.
    expect(
      hubServer.invocations.filter((i) => i.target === 'SubscribeToAgentPresenceAsync'),
    ).toHaveLength(2);
  });

  it('ServerEndedClose_ShouldNotNegotiate_WhenTheRestartedHubIsEndedAgainWhileASubscriberStaysMounted', async () => {
    const m = await load();
    await mountConnected(m, { withPresenceSubscriber: true });
    m.probeSession.mockImplementationOnce(probeActiveRotatingTo(m, 'T2'));
    await change(() => hubServer.pushRevocation());
    expect(m.useRealtimeStore.getState().connectionState).toBe('connected');
    const negotiationsBefore = hubServer.negotiations.length;

    await change(() => hubServer.pushRevocation());
    await act(async () => {
      await settle();
    });

    expect(bearersSince(negotiationsBefore)).toEqual([]);
    expect(m.useRealtimeStore.getState().connectionState).toBe('ended');
    expect(m.probeSession).toHaveBeenCalledTimes(1);
  });

  it('SignOut_ShouldNeitherNegotiateNorRefresh_WhenAPresenceSubscriberIsMounted', async () => {
    const m = await load();
    await mountConnected(m, { withPresenceSubscriber: true });
    const negotiationsBefore = hubServer.negotiations.length;

    await change(() => m.useAuthStore.getState().logout());
    await act(async () => {
      await settle();
    });

    expect(bearersSince(negotiationsBefore)).toEqual([]);
    expect(fetchedUrls.filter((u) => u.includes('/api/v1/auth/refresh'))).toEqual([]);
    expect(m.useRealtimeStore.getState().connectionState).toBe('disconnected');
    expect(m.probeSession).not.toHaveBeenCalled();
  });
});
