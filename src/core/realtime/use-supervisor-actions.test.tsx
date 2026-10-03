import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

/**
 * Supervisor actions over the REAL hub (design D3, spec realtime-connection-lifecycle: "A
 * supervisor action on a disconnected hub fails visibly"). A failed action toasts its translated
 * key and never the error's own (English) text, and a call on a hub that is not connected starts
 * nothing. Rendered without an i18n provider, `t` returns the key, so the toast argument is the key.
 */
vi.mock('@microsoft/signalr', async (importOriginal) => {
  const { withInMemoryTransport } = await import('@/test/signalr-harness');
  return withInMemoryTransport(await importOriginal<typeof import('@microsoft/signalr')>());
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';
import { hubServer } from '@/test/signalr-harness';

const A_USER = { id: 'sup-1', email: 's@b.com', displayName: 'Sup', role: 'supervisor' } as const;
const RS = '\u001e';

interface Loaded {
  hub: typeof import('@/core/realtime/platform-hub');
  actions: typeof import('@/core/realtime/use-supervisor-actions');
  useAuthStore: (typeof import('@/core/auth/auth-store'))['useAuthStore'];
}

let loaded: Loaded | null = null;

async function load(): Promise<Loaded> {
  vi.resetModules();
  const hub = await import('@/core/realtime/platform-hub');
  const actions = await import('@/core/realtime/use-supervisor-actions');
  const auth = await import('@/core/auth/auth-store');
  loaded = { hub, actions, useAuthStore: auth.useAuthStore };
  loaded.useAuthStore.getState().setAuth('T1', Date.now() + 15 * 60_000, A_USER, 'tenant-1', [], {
    realtimePushSignalR: true,
  });
  return loaded;
}

/** Lets every pending microtask and zero-delay timer run (the harness never waits on a clock). */
async function settle(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe('useSupervisorActions', () => {
  beforeEach(() => {
    sessionStorage.clear();
    hubServer.reset();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
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

  it.each([
    ['startSupervision', 'toasts.supervisor.startSupervisionFailed'],
    ['whisper', 'toasts.supervisor.whisperFailed'],
    ['stopSupervision', 'toasts.supervisor.stopSupervisionFailed'],
  ] as const)(
    'SupervisorAction_ShouldToastTheTranslatedKeyAndNotConnect_WhenTheHubIsDisconnected (%s)',
    async (action, key) => {
      const { hub, actions } = await load();
      await hub.startPlatformHub();
      await hub.stopPlatformHub();
      const { result } = renderHook(() => actions.useSupervisorActions('conv-1'));

      await act(async () => {
        if (action === 'startSupervision') await result.current.startSupervision('Listen');
        else if (action === 'whisper') await result.current.whisper('hold on');
        else await result.current.stopSupervision();
        await settle();
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(key);
      // No connection attempt after the stop: still the one negotiate from the start.
      expect(hubServer.bearers).toEqual(['T1']);
      expect(hubServer.invocations).toHaveLength(0);
    },
  );

  it('SupervisorAction_ShouldToastTheTranslatedKeyNotTheServerText_WhenTheServerRejectsTheCall', async () => {
    const { hub, actions } = await load();
    await hub.startPlatformHub();
    hubServer.completeInvocations = false;
    const { result } = renderHook(() => actions.useSupervisorActions('conv-1'));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.startSupervision('Barge');
    });
    await vi.waitFor(() => expect(hubServer.invocations).toHaveLength(1));
    const invocationId = hubServer.invocations[0]?.invocationId;
    hubServer.pushRaw(
      JSON.stringify({ type: 3, invocationId, error: 'Supervisor is not allowed to barge.' }) + RS,
    );
    await act(async () => {
      await pending;
    });

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('toasts.supervisor.startSupervisionFailed');
  });

  it('Whisper_ShouldToastSuccess_WhenTheHubIsConnected', async () => {
    const { hub, actions } = await load();
    await hub.startPlatformHub();
    const { result } = renderHook(() => actions.useSupervisorActions('conv-1'));

    await act(async () => {
      await result.current.whisper('  hold on  ');
    });

    expect(hubServer.invocations).toEqual([
      expect.objectContaining({ target: 'WhisperToAgentAsync', arguments: ['conv-1', 'hold on'] }),
    ]);
    expect(toast.success).toHaveBeenCalledWith('toasts.supervisor.whisperSent');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
