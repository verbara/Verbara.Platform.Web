import { useEffect } from 'react';
import { useAuthStore } from '@/core/auth/auth-store';
// Imported from the module, never from the `@/core/realtime` barrel: the barrel re-exports from
// inside this directory, so importing it here would create an import cycle.
import { startPlatformHub, stopPlatformHub } from './platform-hub';

/**
 * Starts the realtime hub when there is a credential and the realtime feature is on, and stops it
 * otherwise. It is the only credential-dependent consumer that lives outside `AuthGuard`, so it must
 * never open a connection while the session is still restoring (a rehydrated user, no token yet);
 * `realtime-bootstrap-gating.test.tsx` pins that.
 *
 * Moved out of `app.tsx` unchanged, so its behaviour can be tested against the real hook.
 */
export function useRealtimeBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const signalREnabled = useAuthStore((s) => s.features?.realtimePushSignalR === true);

  useEffect(() => {
    if (!accessToken || !signalREnabled) {
      stopPlatformHub().catch(() => undefined);
      return;
    }
    startPlatformHub().catch(() => undefined);
    return () => {
      stopPlatformHub().catch(() => undefined);
    };
  }, [accessToken, signalREnabled]);
}
