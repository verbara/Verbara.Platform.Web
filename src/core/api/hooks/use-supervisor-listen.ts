import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { isApiError } from '@/core/api/api-error';
import { toastApiError } from '@/core/api/toast-api-error';
import { supervisorListenRefusals } from '@/core/api/supervisor-listen-refusals';
import { useListenStore } from '@/core/voice/listen-store';
import { hangupListenLeg, subscribeListenLegEnded } from '@/core/voice/listen-agent';
import type { ActiveSession } from './use-supervisor';

/**
 * Silent listen (Platform change `supervisor-silent-listen`; design D4 here). Typed on the generated
 * schemas, field for field as the host's fixtures freeze them. Separate from `use-supervisor.ts`
 * (design D9): the Agent Assist transcript subscription there is a different route and is untouched.
 *
 * A listen's state comes only from the server: a 200 of the start route or of the current route.
 */

type Schemas = components['schemas'];
export type SupervisorListenEndpoint = Schemas['SupervisorListenEndpointDto'];
export type SupervisorListen = Schemas['SupervisorListenDto'];
export type SupervisorListenStopped = Schemas['SupervisorListenStoppedDto'];
export type ListenPhone = Schemas['ListenPhoneDto'];

/** Where the supervisor's leg rings: the browser's listen user agent or the admin-set phone. */
export type ListenDestination = 'endpoint' | 'phone';

export const CURRENT_LISTEN_KEY = ['supervisor', 'listen', 'current'] as const;
const listenPhoneKey = (userId: string) => ['admin', 'users', userId, 'listen-phone'] as const;

function isListenNotFound(err: unknown): boolean {
  return isApiError(err) && err.code === 'listen-not-found';
}

// ─── Listen endpoint ────────────────────────────────────

/** `POST /api/v1/supervisor/listen-endpoint`, no body: the caller's own listen credentials. */
export function requestListenEndpoint(): Promise<SupervisorListenEndpoint> {
  return customFetch<SupervisorListenEndpoint>({
    url: '/api/v1/supervisor/listen-endpoint',
    method: 'POST',
  });
}

/**
 * The listen credentials as a mutation. The operations shell's `useListenAgent` calls
 * {@link requestListenEndpoint} itself, keyed on the principal; the secret never enters the query
 * cache (a mutation keeps no data once its observer unmounts, and nothing reads it but the agent).
 */
export function useListenEndpoint() {
  return useMutation({ mutationFn: requestListenEndpoint });
}

// ─── Start / current / stop ─────────────────────────────

/**
 * "Listen": `POST /api/v1/supervisor/conversations/{conversationId}/listen` with exactly
 * `{destination}`. The conversation is pending from the send until the answer, because the leg can
 * ring before the 200 (the listen agent answers a pending conversation). A refusal or a network
 * failure clears it and shows the refusal's localized message; the state stays idle.
 */
export function useStartListen() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      conversationId,
      destination,
    }: {
      conversationId: string;
      destination: ListenDestination;
    }) =>
      customFetch<SupervisorListen>({
        url: `/api/v1/supervisor/conversations/${encodeURIComponent(conversationId)}/listen`,
        method: 'POST',
        data: { destination } satisfies Schemas['SupervisorListenStartRequest'],
      }),
    onMutate: ({ conversationId }) => {
      useListenStore.getState().setPending(conversationId);
    },
    onSuccess: (listen) => {
      useListenStore.getState().setActiveListen(listen);
      qc.setQueryData(CURRENT_LISTEN_KEY, listen);
    },
    onError: (err) => {
      useListenStore.getState().clearPending();
      toastApiError(err, supervisorListenRefusals, t);
    },
  });
}

/** Poll every second while dialing (audio within 1 s of answer), every five while listening. */
export function currentListenInterval(listen: SupervisorListen | null | undefined): number | false {
  if (listen?.state === 'dialing') return 1_000;
  if (listen?.state === 'listening') return 5_000;
  return false;
}

/**
 * `GET /api/v1/supervisor/listen`: the caller's one active listen, wherever it was started. Read
 * once when the monitor opens, then polled while a listen is held; 404 `listen-not-found` means
 * none and stops polling. When the browser leg ends on its own the listen is read again instead of
 * assuming why it ended.
 */
export function useCurrentListen(enabled = true) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    return subscribeListenLegEnded(() => {
      void qc.invalidateQueries({ queryKey: CURRENT_LISTEN_KEY });
    });
  }, [enabled, qc]);

  return useQuery({
    queryKey: CURRENT_LISTEN_KEY,
    queryFn: async (): Promise<SupervisorListen | null> => {
      try {
        const listen = await customFetch<SupervisorListen>({
          url: '/api/v1/supervisor/listen',
          method: 'GET',
        });
        useListenStore.getState().setActiveListen(listen);
        return listen;
      } catch (err) {
        if (!isListenNotFound(err)) throw err;
        useListenStore.getState().setActiveListen(null);
        return null;
      }
    },
    enabled,
    refetchInterval: (query) => currentListenInterval(query.state.data),
  });
}

/**
 * "Stop listening": `POST …/listen/stop`, no body. A 200 or a 404 `listen-not-found` both end the
 * listen: the console shows none and hangs up the browser leg if it is still up.
 */
export function useStopListen() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: async (conversationId: string): Promise<SupervisorListenStopped | null> => {
      try {
        return await customFetch<SupervisorListenStopped>({
          url: `/api/v1/supervisor/conversations/${encodeURIComponent(conversationId)}/listen/stop`,
          method: 'POST',
        });
      } catch (err) {
        if (isListenNotFound(err)) return null;
        throw err;
      }
    },
    onSuccess: () => {
      useListenStore.getState().setActiveListen(null);
      qc.setQueryData(CURRENT_LISTEN_KEY, null);
      void hangupListenLeg();
    },
    onError: (err) => {
      toastApiError(err, supervisorListenRefusals, t);
    },
  });
}

// ─── Admin listen phone ─────────────────────────────────

/** `GET /api/v1/admin/users/{userId}/listen-phone`: the number a supervisor's phone listen rings. */
export function useListenPhone(userId: string | undefined) {
  return useQuery({
    queryKey: listenPhoneKey(userId ?? ''),
    queryFn: () =>
      customFetch<ListenPhone>({
        url: `/api/v1/admin/users/${encodeURIComponent(userId ?? '')}/listen-phone`,
        method: 'GET',
      }),
    enabled: Boolean(userId),
  });
}

/**
 * `PUT /api/v1/admin/users/{userId}/listen-phone` with `{phoneNumber}`: the text as typed, trimmed
 * (spaces, dashes and parentheses are kept: Platform is the authority on E.164); empty or `null`
 * clears it. Refusals are left to the caller, which keeps its editor open on `listen-phone-invalid`.
 */
export function useSetListenPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, phoneNumber }: { userId: string; phoneNumber: string | null }) => {
      const trimmed = phoneNumber?.trim() ?? '';
      const body: Schemas['ListenPhoneRequest'] = { phoneNumber: trimmed === '' ? null : trimmed };
      return customFetch<ListenPhone>({
        url: `/api/v1/admin/users/${encodeURIComponent(userId)}/listen-phone`,
        method: 'PUT',
        data: body,
      });
    },
    onSuccess: (saved, { userId }) => {
      qc.setQueryData(listenPhoneKey(userId), saved);
    },
  });
}

// ─── Voice monitor rows ─────────────────────────────────

/**
 * A voice-monitor row as the extended `GET /api/v1/supervisor/sessions/active` answers it: the
 * Agent Assist session plus the generated `ActiveSessionDto.conversationId` (design D3).
 */
export type ListenableSession = ActiveSession & {
  conversationId?: Schemas['ActiveSessionDto']['conversationId'];
};

/**
 * The conversation a listen on this row is keyed by: the row's own `conversationId`, never derived
 * from the session id or any other field. `null` (or absent, from an older Platform) disables Listen.
 */
export function conversationIdOfSession(session: ListenableSession): string | null {
  const id = session.conversationId;
  return typeof id === 'string' && id !== '' ? id : null;
}
