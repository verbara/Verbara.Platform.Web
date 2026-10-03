import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/core/auth/auth-store';
import { useRealtimeStore } from '@/core/stores/realtime-store';
// Imported from the module, never from the `@/core/realtime` barrel: the barrel re-exports from
// inside this directory, so importing it here would create an import cycle.
import { startPlatformHub, stopPlatformHub } from './platform-hub';

/**
 * Owns the realtime hub's lifecycle (design D4). It is the only credential-dependent consumer that
 * lives outside `AuthGuard`, so it must never open a connection while the session is still
 * restoring (a rehydrated user, no token yet); `realtime-bootstrap-gating.test.tsx` pins that.
 *
 * Two effects:
 * - **Lifecycle**, keyed on the principal: feature enabled, token present, tenant, user and
 *   impersonation. It starts the hub when all are present and stops it otherwise, so sign-in,
 *   sign-out, switching user or tenant and starting or ending an impersonation restart it. A
 *   refreshed token for the same principal does not: the server bounds the connection's lifetime
 *   (it closes at the token's `exp` and allows a reconnect, which presents the current token).
 * - **Revival**, keyed on the token value. On a refresh it starts the hub only when the hub is not
 *   connected and not trying to connect (`disconnected`, `failed` or `ended`), so a hub that gave up
 *   comes back within one token period without a healthy connection ever being restarted.
 *
 * Start and stop are serialized inside `platform-hub` (design D3), so neither effect awaits.
 */
export function useRealtimeBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasToken = Boolean(accessToken);
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const impersonating = useAuthStore((s) => s.impersonation?.active === true);
  const signalREnabled = useAuthStore((s) => s.features?.realtimePushSignalR === true);

  /** The token the lifecycle effect last started the hub for; the revival skips that one. */
  const startedForToken = useRef<string | null>(null);

  useEffect(() => {
    if (!hasToken || !signalREnabled) {
      startedForToken.current = null;
      stopPlatformHub().catch(() => undefined);
      return;
    }
    startedForToken.current = useAuthStore.getState().accessToken;
    startPlatformHub().catch(() => undefined);
    return () => {
      stopPlatformHub().catch(() => undefined);
    };
  }, [hasToken, signalREnabled, tenantId, userId, impersonating]);

  useEffect(() => {
    if (!accessToken || !signalREnabled) return;
    // The lifecycle effect has just (re)started the hub for this very token.
    if (startedForToken.current === accessToken) return;
    const state = useRealtimeStore.getState().connectionState;
    if (state === 'disconnected' || state === 'failed' || state === 'ended') {
      startPlatformHub().catch(() => undefined);
    }
  }, [accessToken, signalREnabled]);
}
