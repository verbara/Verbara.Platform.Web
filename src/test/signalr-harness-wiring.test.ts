import { describe, it, expect, vi, afterAll, beforeEach } from 'vitest';

/**
 * Wiring self-test of the in-memory SignalR harness: the partial `vi.mock('@microsoft/signalr')`
 * documented in `signalr-harness.ts` drives the app's own, unmodified `platform-hub.ts` (its
 * relative `/hubs/platform` URL, its `accessTokenFactory` reading the auth store, its handlers),
 * so the hub-lifecycle tests can run against the real module.
 */
vi.mock('@microsoft/signalr', async (importOriginal) => {
  const { withInMemoryTransport } = await import('@/test/signalr-harness');
  return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
});

import { hubServer } from '@/test/signalr-harness';
import { useAuthStore } from '@/core/auth/auth-store';
import { useRealtimeStore } from '@/core/stores/realtime-store';
import { startPlatformHub, stopPlatformHub } from '@/core/realtime/platform-hub';

const A_USER = { id: 'user-1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

describe('signalr-harness wiring through platform-hub', () => {
  beforeEach(() => {
    hubServer.reset();
    useAuthStore.getState().setAuth('T1', Date.now() + 15 * 60_000, A_USER, 'tenant-1', [], {
      realtimePushSignalR: true,
    });
  });

  afterAll(async () => {
    await stopPlatformHub();
    useAuthStore.getState().logout();
    hubServer.reset();
  });

  it('Wiring_ShouldConnectPlatformHubAndRecordTheStoreToken', async () => {
    await startPlatformHub();

    expect(useRealtimeStore.getState().connectionState).toBe('connected');
    expect(hubServer.bearers).toEqual(['T1']);
    expect(hubServer.negotiations[0]?.url).toMatch(/\/hubs\/platform\/negotiate\?/);
  });

  it('Wiring_ShouldDeliverAServerPushToTheRegisteredHandler', async () => {
    await startPlatformHub();

    hubServer.pushInvocation('OnPresenceUpdated', {
      agentId: 'agent-1',
      state: 'Available',
      lastHeartbeat: '2026-10-02T12:00:00Z',
    });

    await vi.waitFor(() =>
      expect(useRealtimeStore.getState().agentPresences['agent-1']?.state).toBe('available'),
    );
  });

  it('Wiring_ShouldStopPlatformHub', async () => {
    await startPlatformHub();

    await stopPlatformHub();

    expect(useRealtimeStore.getState().connectionState).toBe('disconnected');
    expect(hubServer.transport.connected).toBe(false);
  });
});
