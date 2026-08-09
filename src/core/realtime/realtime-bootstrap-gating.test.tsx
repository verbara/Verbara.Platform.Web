import { renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { useAuthStore } from '@/core/auth/auth-store';
import { startPlatformHub, stopPlatformHub } from '@/core/realtime';

vi.mock('@/core/realtime', () => ({
  startPlatformHub: vi.fn(() => Promise.resolve()),
  stopPlatformHub: vi.fn(() => Promise.resolve()),
}));

/**
 * Mirror of `useRealtimeBootstrap` in `app.tsx`. It is the ONLY credential-dependent consumer that
 * lives outside `AuthGuard` (AppShell's SSE hook and the agent layout's heartbeat/departure beacon
 * mount inside the guard, so they cannot run during a restore). This test pins the invariant that
 * it never opens a connection while the session is still restoring — i.e. while the store has been
 * rehydrated with a user but no token.
 */
function useRealtimeBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const signalREnabled = useAuthStore((s) => s.features?.realtimePushSignalR === true);

  useEffect(() => {
    if (!accessToken || !signalREnabled) {
      void stopPlatformHub();
      return;
    }
    void startPlatformHub();
    return () => {
      void stopPlatformHub();
    };
  }, [accessToken, signalREnabled]);
}

const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

describe('realtime bootstrap gating', () => {
  beforeEach(() => {
    vi.mocked(startPlatformHub).mockClear();
    vi.mocked(stopPlatformHub).mockClear();
    useAuthStore.getState().logout();
  });

  it('should_NotStartHub_WhenSessionIsRestoring', () => {
    // Rehydrated after a reload: a user, the feature on, but no credential yet.
    useAuthStore.setState({
      user: A_USER,
      tenantId: 'tenant-1',
      features: { realtimePushSignalR: true },
      accessToken: null,
      tokenExpiry: null,
    });

    renderHook(() => useRealtimeBootstrap());

    expect(startPlatformHub).not.toHaveBeenCalled();
  });

  it('should_StartHub_WhenTokenLandsAfterRestore', () => {
    useAuthStore.setState({
      user: A_USER,
      tenantId: 'tenant-1',
      features: { realtimePushSignalR: true },
      accessToken: null,
      tokenExpiry: null,
    });

    const { rerender } = renderHook(() => useRealtimeBootstrap());
    expect(startPlatformHub).not.toHaveBeenCalled();

    // The restore mints a token — the effect's dependency on it is what makes the hub start.
    useAuthStore.getState().setAuth('minted-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {
      realtimePushSignalR: true,
    });
    rerender();

    expect(startPlatformHub).toHaveBeenCalledTimes(1);
  });
});
