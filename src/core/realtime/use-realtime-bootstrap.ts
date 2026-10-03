import { useEffect, useRef } from 'react';
import { probeSession } from '@/core/api/client';
import { queryClient } from '@/core/api/query-client';
import { useAuthStore } from '@/core/auth/auth-store';
import { safeAgentTeardown } from '@/core/session/agent-teardown';
import { useRealtimeStore } from '@/core/stores/realtime-store';
// Imported from the module, never from the `@/core/realtime` barrel: the barrel re-exports from
// inside this directory, so importing it here would create an import cycle.
import { startPlatformHub, stopPlatformHub } from './platform-hub';

/** Where a sign-out forced by the server lands: `/login` with its session-ended notice (design D7). */
const SESSION_ENDED_LOGIN = '/login?reason=session-ended';

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
 * - **Session check** (design D5), keyed on the principal like the lifecycle. When the server ends
 *   the hub without allowing a reconnect (state `ended`), it asks the server whether the session
 *   still exists ({@link probeSession}, a forced refresh) and acts on the verdict:
 *   - `ended` (401 or 403): the agent-aware teardown ({@link safeAgentTeardown}, a routable agent is
 *     set non-routable first) with the app's shared query client, then `logout()`, then a full page
 *     load of `/login?reason=session-ended`;
 *   - `active`: one restart, remembering the token it was made with. A second server-ended close
 *     while that token is current leaves the hub `ended`, with no probe and no start, until the
 *     next refresh (the revival) or principal change (the lifecycle);
 *   - `unknown` (no HTTP verdict): nothing. The user stays signed in and the hub stays `ended`.
 *
 * Start and stop are serialized inside `platform-hub` (design D3), so no effect awaits them.
 */
export function useRealtimeBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasToken = Boolean(accessToken);
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const impersonating = useAuthStore((s) => s.impersonation?.active === true);
  const signalREnabled = useAuthStore((s) => s.features?.realtimePushSignalR === true);

  /** The token the hub was last started for (lifecycle or session check); the revival skips it. */
  const startedForToken = useRef<string | null>(null);
  /** The session check waiting for its verdict, if any; the revival leaves the hub to it. */
  const pendingCheck = useRef<object | null>(null);
  /** The token the session check's one restart was made with. */
  const restartedForToken = useRef<string | null>(null);

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
    // The lifecycle effect (or the session check) has just (re)started the hub for this very token.
    if (startedForToken.current === accessToken) return;
    // A session check is in flight, and its probe may be what just applied this token: the check's
    // verdict decides whether the hub restarts, so the revival must not add a second start.
    if (pendingCheck.current) return;
    const state = useRealtimeStore.getState().connectionState;
    if (state === 'disconnected' || state === 'failed' || state === 'ended') {
      startPlatformHub().catch(() => undefined);
    }
  }, [accessToken, signalREnabled]);

  useEffect(() => {
    if (!hasToken || !signalREnabled) return;
    // Cleared when the principal changes or the session ends: a verdict that lands after that is
    // about a principal that is no longer current, so it is dropped.
    let current = true;

    const resolveEndedHub = () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) return;
      // The one restart for this token was ended the same way: stay `ended`.
      if (restartedForToken.current === token) return;

      const check = {};
      pendingCheck.current = check;
      void probeSession()
        .then(async (verdict) => {
          if (!current) return;
          if (verdict === 'ended') {
            await safeAgentTeardown(queryClient);
            useAuthStore.getState().logout();
            window.location.href = SESSION_ENDED_LOGIN;
            return;
          }
          if (verdict !== 'active') return;
          // The probe may have applied a refreshed token; restart with the one held now.
          const restartToken = useAuthStore.getState().accessToken;
          restartedForToken.current = restartToken;
          // Should the re-render for a token the probe applied land only after this verdict, the
          // revival skips that token instead of starting the hub a second time.
          startedForToken.current = restartToken;
          startPlatformHub().catch(() => undefined);
        })
        .finally(() => {
          if (pendingCheck.current === check) pendingCheck.current = null;
        });
    };

    // A store subscription rather than a selector: the app root would otherwise re-render on every
    // hub state change.
    const unsubscribe = useRealtimeStore.subscribe((state, prev) => {
      if (state.connectionState === 'ended' && prev.connectionState !== 'ended') resolveEndedHub();
    });
    return () => {
      current = false;
      // A check left in flight is void now; it must not hold up the next principal's checks.
      pendingCheck.current = null;
      unsubscribe();
    };
  }, [hasToken, signalREnabled, tenantId, userId, impersonating]);
}
