import { useEffect } from 'react';
import { customFetch } from '@/core/api/client';
import { isApiError } from '@/core/api/api-error';
import { useAuthStore } from '@/core/auth/auth-store';
import { getConfig } from '@/core/hooks/use-config';
import { startListenAgent, stopListenAgent, type ListenCredentials } from './listen-agent';
import { useListenStore, type ListenUnavailableReason } from './listen-store';

const MONITOR_PERMISSION = 'contacts:conversation:monitor';

/**
 * Principals whose listen-endpoint route refused with 403 `not-permitted` or 409
 * `no-supervisor-endpoint`: the route is not called again for them (design D2). Module-level so a
 * remount of the operations shell keeps the answer; a principal change asks again.
 */
const refusedPrincipals = new Map<string, ListenUnavailableReason>();

/** Test seam: forget the refusals between cases. */
export function __resetListenRefusalsForTests(): void {
  refusedPrincipals.clear();
}

/**
 * `POST /api/v1/supervisor/listen-endpoint`, no body.
 *
 * Interim until openapi.d.ts regenerates (supervisor-silent-listen): the call lives here, typed from
 * the fixture copy, until gate G2 lands `useListenEndpoint` in `src/core/api/hooks/use-supervisor-listen.ts`
 * on the generated `SupervisorListenEndpointDto` (task 2.5).
 */
function requestListenCredentials(): Promise<ListenCredentials> {
  return customFetch<ListenCredentials>({
    url: '/api/v1/supervisor/listen-endpoint',
    method: 'POST',
  });
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
    requestListenCredentials()
      .then(async (credentials) => {
        if (!current) return;
        await startListenAgent(wssUrl, credentials);
      })
      .catch((err: unknown) => {
        if (!current) return;
        if (
          isApiError(err) &&
          (err.code === 'not-permitted' || err.code === 'no-supervisor-endpoint')
        ) {
          refusedPrincipals.set(principal, err.code);
          useListenStore.getState().setUnavailable(err.code);
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
