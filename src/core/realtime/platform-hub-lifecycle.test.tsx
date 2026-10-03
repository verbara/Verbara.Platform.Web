import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

/**
 * Hub start/stop discipline (design D3, spec realtime-connection-lifecycle: "Hub start and stop
 * MUST be serialized" and "Invoking a hub method MUST NOT start the hub").
 *
 * Every test drives the app's own `platform-hub.ts` over the REAL `@microsoft/signalr`
 * `HubConnection`, through the in-memory transport of `@/test/signalr-harness`. Each test loads a
 * fresh module graph, so the module-level connection starts out unbuilt and no test inherits
 * another's hub. The harness server lives on `globalThis`, so it is shared across the reset.
 */
vi.mock('@microsoft/signalr', async (importOriginal) => {
  const { withInMemoryTransport } = await import('@/test/signalr-harness');
  return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
});

import { hubServer } from '@/test/signalr-harness';

const A_USER = { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

interface Loaded {
  hub: typeof import('@/core/realtime/platform-hub');
  presence: typeof import('@/core/realtime/use-realtime-presence');
  useRealtimeStore: (typeof import('@/core/stores/realtime-store'))['useRealtimeStore'];
  useAuthStore: (typeof import('@/core/auth/auth-store'))['useAuthStore'];
}

let loaded: Loaded | null = null;
/** `hubServer.transports` outlives `reset()`; each test counts the connections it built itself. */
let transportsBefore = 0;

function connectionsBuilt(): number {
  return hubServer.transports.length - transportsBefore;
}

async function load(): Promise<Loaded> {
  vi.resetModules();
  transportsBefore = hubServer.transports.length;
  // Sequential on purpose: concurrent imports can evaluate a mock factory twice.
  const hub = await import('@/core/realtime/platform-hub');
  const presence = await import('@/core/realtime/use-realtime-presence');
  const realtime = await import('@/core/stores/realtime-store');
  const auth = await import('@/core/auth/auth-store');
  loaded = {
    hub,
    presence,
    useRealtimeStore: realtime.useRealtimeStore,
    useAuthStore: auth.useAuthStore,
  };
  loaded.useAuthStore.getState().setAuth('T1', Date.now() + 15 * 60_000, A_USER, 'tenant-1', [], {
    realtimePushSignalR: true,
  });
  return loaded;
}

/**
 * Lets every pending microtask and zero-delay timer run. The harness answers with microtasks only,
 * so a few macrotask turns are enough for any connection attempt to reach negotiate. This is a
 * flush, not a wall-clock wait.
 */
async function settle(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe('platform-hub lifecycle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    hubServer.reset();
  });

  afterEach(async () => {
    // Unmount first: a mounted subscriber's cleanup runs on unmount and must not outlive the test.
    cleanup();
    if (loaded) {
      await loaded.hub.stopPlatformHub().catch(() => undefined);
      await settle();
      loaded.useAuthStore.getState().logout();
      loaded = null;
    }
    hubServer.reset();
  });

  // ── 4.1 (W3 regression): the stop/start race of a token rotation ──

  it('StartPlatformHub_ShouldResolveConnected_WhenIssuedRightAfterAnUnawaitedStop', async () => {
    const { hub, useRealtimeStore } = await load();
    await hub.startPlatformHub();
    expect(useRealtimeStore.getState().connectionState).toBe('connected');

    // What the bootstrap effect does on every token rotation: an un-awaited stop, then a start.
    void hub.stopPlatformHub();
    await hub.startPlatformHub();

    expect(useRealtimeStore.getState().connectionState).toBe('connected');
  });

  // ── 4.3 (W3 regression): invokeHub's implicit start after a sign-out ──

  it('StopPlatformHub_ShouldNotBeFollowedByANegotiate_WhenAPresenceSubscriberIsMounted', async () => {
    const { hub, presence, useRealtimeStore, useAuthStore } = await load();
    await hub.startPlatformHub();
    renderHook(() => presence.useRealtimePresence('agent-1'));
    await act(async () => {
      await settle();
    });
    expect(hubServer.invocations.map((i) => i.target)).toContain('SubscribeToAgentPresenceAsync');
    expect(hubServer.bearers).toEqual(['T1']);

    // Sign out the way the app does: clear the session, then stop the hub.
    await act(async () => {
      useAuthStore.getState().logout();
      await hub.stopPlatformHub();
    });
    await act(async () => {
      await settle();
    });

    // The subscriber's cleanup runs when the state leaves `connected`; it must not reconnect.
    expect(hubServer.bearers).toEqual(['T1']);
    expect(useRealtimeStore.getState().connectionState).toBe('disconnected');
  });

  // ── 4.4: serialization, connection reuse and the no-implicit-start rule ──

  it('StartStopStart_ShouldEndConnectedWithNoRejection_WhenRequestedInQuickSuccession', async () => {
    const { hub, useRealtimeStore } = await load();

    // A development-mode double mount: start, stop and start, none awaited before the next.
    const outcomes = await Promise.allSettled([
      hub.startPlatformHub(),
      hub.stopPlatformHub(),
      hub.startPlatformHub(),
    ]);

    expect(outcomes.map((o) => o.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(useRealtimeStore.getState().connectionState).toBe('connected');
    expect(hubServer.transport.connected).toBe(true);
    // One connection object, connected twice: the first start, then the start after the stop.
    expect(connectionsBuilt()).toBe(1);
    expect(hubServer.bearers).toEqual(['T1', 'T1']);
  });

  it('StartPlatformHub_ShouldBeANoOpAndReuseTheConnection_WhenTheHubIsAlreadyConnected', async () => {
    const { hub, useRealtimeStore } = await load();

    await Promise.all([hub.startPlatformHub(), hub.startPlatformHub()]);
    await hub.startPlatformHub();

    expect(useRealtimeStore.getState().connectionState).toBe('connected');
    expect(connectionsBuilt()).toBe(1);
    expect(hubServer.negotiations).toHaveLength(1);
  });

  it('StartPlatformHub_ShouldBeANoOp_WhenTheLibraryIsReconnecting', async () => {
    const { hub, useRealtimeStore } = await load();
    await hub.startPlatformHub();
    // Hold the library in its retry delay (the default policy's first retry is immediate).
    hubServer.retryDelays = [60_000];

    hubServer.dropTransport();
    await vi.waitFor(() =>
      expect(useRealtimeStore.getState().connectionState).toBe('reconnecting'),
    );
    await hub.startPlatformHub();

    expect(useRealtimeStore.getState().connectionState).toBe('reconnecting');
    expect(hubServer.negotiations).toHaveLength(1);
  });

  it('StartPlatformHub_ShouldWaitForAServerCloseInProgress_WhenTheConnectionIsStillDisconnecting', async () => {
    const { hub, useRealtimeStore } = await load();
    await hub.startPlatformHub();
    // Hold the transport's close open, so the connection sits in `Disconnecting` for a while.
    hubServer.stopDelayMs = 20;

    hubServer.pushRevocation();
    await hub.startPlatformHub();

    expect(useRealtimeStore.getState().connectionState).toBe('connected');
    expect(hubServer.bearers).toEqual(['T1', 'T1']);
  });

  it('InvokeHub_ShouldRejectWithHubNotConnectedErrorAndNotNegotiate_WhenTheHubWasNeverStarted', async () => {
    const { hub, useRealtimeStore } = await load();

    await expect(hub.invokeHub('SubscribeToAgentPresenceAsync', 'agent-1')).rejects.toBeInstanceOf(
      hub.HubNotConnectedError,
    );
    await settle();

    expect(hubServer.negotiations).toHaveLength(0);
    expect(connectionsBuilt()).toBe(0);
    expect(useRealtimeStore.getState().connectionState).toBe('disconnected');
  });

  it('InvokeHub_ShouldRejectWithHubNotConnectedErrorAndNotNegotiate_WhenTheHubWasStopped', async () => {
    const { hub, useRealtimeStore } = await load();
    await hub.startPlatformHub();
    await hub.stopPlatformHub();

    await expect(hub.invokeHub('StartSupervisionAsync', 'conv-1', 'Listen')).rejects.toBeInstanceOf(
      hub.HubNotConnectedError,
    );
    await settle();

    expect(hubServer.bearers).toEqual(['T1']);
    expect(hubServer.invocations).toHaveLength(0);
    expect(useRealtimeStore.getState().connectionState).toBe('disconnected');
  });

  it('InvokeHub_ShouldRejectWithoutOverwritingReconnecting_WhenTheLibraryIsReconnecting', async () => {
    const { hub, useRealtimeStore } = await load();
    await hub.startPlatformHub();
    hubServer.retryDelays = [60_000];
    hubServer.dropTransport();
    await vi.waitFor(() =>
      expect(useRealtimeStore.getState().connectionState).toBe('reconnecting'),
    );

    await expect(
      hub.invokeHub('UnsubscribeFromAgentPresenceAsync', 'agent-1'),
    ).rejects.toBeInstanceOf(hub.HubNotConnectedError);
    await settle();

    // Before D3 the implicit start rejected here and overwrote `reconnecting` with `failed`.
    expect(useRealtimeStore.getState().connectionState).toBe('reconnecting');
    expect(hubServer.negotiations).toHaveLength(1);
  });

  it('InvokeHub_ShouldSendTheCall_WhenTheHubIsConnected', async () => {
    const { hub } = await load();
    await hub.startPlatformHub();

    await expect(hub.invokeHub('SubscribeToAgentPresenceAsync', 'agent-1')).resolves.toBeNull();

    expect(hubServer.invocations).toEqual([
      expect.objectContaining({ target: 'SubscribeToAgentPresenceAsync', arguments: ['agent-1'] }),
    ]);
  });

  it('StopPlatformHub_ShouldResetTheRealtimeStore_WhenTheHubIsStopped', async () => {
    const { hub, useRealtimeStore } = await load();
    await hub.startPlatformHub();
    useRealtimeStore.getState().setObservedSupervision({
      conversationId: 'conv-1',
      supervisorId: 'sup-1',
      mode: 'Listen',
      startedAt: '2026-10-02T12:00:00Z',
    });

    await hub.stopPlatformHub();

    expect(useRealtimeStore.getState().connectionState).toBe('disconnected');
    expect(useRealtimeStore.getState().observedSupervision).toBeNull();
    expect(hubServer.clientCloseCount).toBe(1);
  });

  it('StartPlatformHub_ShouldReportFailed_WhenTheConnectAttemptIsRefused', async () => {
    const { hub, useRealtimeStore } = await load();
    hubServer.negotiateStatus = 503;

    await expect(hub.startPlatformHub()).rejects.toThrow();

    expect(useRealtimeStore.getState().connectionState).toBe('failed');
    // The chain survives a failed operation: the next start runs and connects.
    hubServer.negotiateStatus = 200;
    await hub.startPlatformHub();
    expect(useRealtimeStore.getState().connectionState).toBe('connected');
  });
});
