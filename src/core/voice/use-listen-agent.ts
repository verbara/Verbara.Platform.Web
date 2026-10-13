import { useEffect } from 'react';
import { requestListenEndpoint } from '@/core/api/hooks/use-supervisor-listen';
import { isApiError } from '@/core/api/api-error';
import { useAuthStore } from '@/core/auth/auth-store';
import { getConfig } from '@/core/hooks/use-config';
import { startListenAgent, stopListenAgent } from './listen-agent';
import { useListenStore, type ListenUnavailableReason } from './listen-store';

const MONITOR_PERMISSION = 'contacts:conversation:monitor';

/**
 * Principals whose listen-endpoint route refused with 403 `not-permitted` (or the role gate's bare
 * 403) or 409 `no-supervisor-endpoint`: the route is not called again for them (design D2). Module-level so a
 * remount of the operations shell keeps the answer; a principal change asks again.
 */
const refusedPrincipals = new Map<string, ListenUnavailableReason>();

/** Test seam: forget the refusals between cases. */
export function __resetListenRefusalsForTests(): void {
  refusedPrincipals.clear();
}

/**
 * The refusals that make the browser destination unavailable for this principal: the route's own
 * `not-permitted` and `no-supervisor-endpoint`, and a 403 with no machine code, which is the
 * `/supervisor` group's role gate answering before the route runs (for example a role that holds
 * `contacts:conversation:monitor` without the supervisor role). Anything else is a failure.
 */
function refusalReasonOf(err: unknown): ListenUnavailableReason | null {
  if (!isApiError(err)) return null;
  if (err.code === 'not-permitted' || err.code === 'no-supervisor-endpoint') return err.code;
  if (err.status === 403 && err.code === null) return 'not-permitted';
  return null;
}

function wssUrlOf(): string {
  try {
    return getConfig().asteriskWssUrl ?? '';
  } catch {
    return '';
  }
}

/**
 * Runs the supervisor's receive-only listen user agent while the operations shell is mounted
 * (design D2; spec `realtime-connection-lifecycle`). Starts only for a user who holds
 * `contacts:conversation:monitor` on a deployment with an Asterisk WSS URL. Keyed on the principal
 * (token present, tenant, user, impersonation) like the hub's lifecycle: sign-out, a user or tenant
 * switch and an impersonation start or end tear it down and fetch the new principal's own
 * credentials; a token refresh for the same principal changes nothing.
 */
export function useListenAgent(): void {
  const hasToken = useAuthStore((s) => Boolean(s.accessToken));
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const impersonating = useAuthStore((s) => s.impersonation?.active === true);
  const canMonitor = useAuthStore((s) => s.permissions.includes(MONITOR_PERMISSION));

  useEffect(() => {
    const wssUrl = wssUrlOf();
    if (!hasToken || !userId || !canMonitor || !wssUrl) return;

    const principal = `${tenantId ?? ''}|${userId}|${impersonating ? 'imp' : 'own'}`;
    const refused = refusedPrincipals.get(principal);
    if (refused) {
      useListenStore.getState().setUnavailable(refused);
      return () => useListenStore.getState().reset();
    }

    let current = true;
    useListenStore.getState().setRegistration('connecting');
    requestListenEndpoint()
      .then(async (credentials) => {
        if (!current) return;
        await startListenAgent(wssUrl, credentials);
      })
      .catch((err: unknown) => {
        if (!current) return;
        const reason = refusalReasonOf(err);
        if (reason) {
          refusedPrincipals.set(principal, reason);
          useListenStore.getState().setUnavailable(reason);
          return;
        }
        useListenStore.getState().setRegistration('failed');
      });

    return () => {
      current = false;
      void stopListenAgent();
      useListenStore.getState().reset();
    };
  }, [hasToken, tenantId, userId, impersonating, canMonitor]);
}
