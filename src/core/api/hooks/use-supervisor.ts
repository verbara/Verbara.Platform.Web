import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * Kept hand-written (openapi-typed-client-operations): the document's `ActiveSessionDto`
 * omits `agentName` and `sentiment`, both read by `session-card.tsx` — swapping onto it would
 * drop fields the UI consumes. Needs a Platform-side supervisor response DTO carrying those
 * fields (same follow-up class as admin→`openapi-response-adoption`) before it can migrate.
 */
export interface ActiveSession {
  sessionId: string;
  agentId: string;
  agentName: string;
  queueName: string;
  callerIdNum: string;
  connectedAt: string;
  sentiment?: string | null;
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ['supervisor', 'sessions', 'active'],
    queryFn: () =>
      customFetch<ActiveSession[]>({ url: '/api/v1/supervisor/sessions/active', method: 'GET' }),
    refetchInterval: 10_000,
  });
}

export function useSendWhisper() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      customFetch<void>({
        url: `/api/v1/supervisor/sessions/${sessionId}/whisper`,
        method: 'POST',
        data: { message },
      }),
    onSuccess: () => toast.success(t('toasts.supervisor.whisperSent')),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartListening() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      customFetch<void>({
        url: `/api/v1/supervisor/sessions/${sessionId}/listen`,
        method: 'POST',
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Digital Conversation Monitoring ────────────────────

/**
 * Kept hand-written (openapi-typed-client-operations): this is the supervisor list view-model
 * (`contactName`, `queueName`, `lastMessage`, `lastMessageAt`, `assignedAt`). The document's
 * `PagedResultOfConversation.items` is the raw `Conversation` ENTITY (`conversationId`,
 * `owner`, `sessions`, …) — a different shape — so there is nothing structurally compatible to
 * swap onto. `PagedResult<T>` below stays a local generic wrapper (design.md task 1.3).
 */
export interface SupervisorConversation {
  id: string;
  contactId: string;
  contactName: string;
  channel: string;
  queueName: string;
  state: string;
  assignedAgentId?: string;
  lastMessage: string;
  lastMessageAt: string;
  assignedAt: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Kept hand-written (openapi-typed-client-operations): supervisor message view-model
 * (`sender`, `senderName`, `text`, `timestamp`, `type`). The document's `Message` is the raw
 * entity (`messageId`, `direction`, `content` envelope, `deliveryStatus`, …) — a different
 * shape — so there is no structurally compatible schema to swap onto.
 */
export interface SupervisorMessage {
  id: string;
  conversationId: string;
  sender: 'agent' | 'customer' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'system';
}

export interface SupervisorConversationFilters {
  queue?: string;
  agent?: string;
  channel?: string;
  state?: string;
  page?: number;
  pageSize?: number;
}

export function useSupervisorConversations(filters?: SupervisorConversationFilters) {
  const params: Record<string, string> = {
    page: String(filters?.page ?? 1),
    pageSize: String(filters?.pageSize ?? 25),
  };
  if (filters?.queue) params.queue = filters.queue;
  if (filters?.agent) params.agent = filters.agent;
  if (filters?.channel) params.channel = filters.channel;
  if (filters?.state) params.state = filters.state;

  return useQuery({
    queryKey: ['supervisor', 'conversations', params],
    queryFn: () =>
      customFetch<PagedResult<SupervisorConversation>>({
        url: '/api/v1/supervisor/conversations',
        method: 'GET',
        params,
      }),
    refetchInterval: 10_000,
  });
}

export function useSupervisorMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['supervisor', 'conversations', conversationId, 'messages'],
    queryFn: () =>
      customFetch<SupervisorMessage[]>({
        url: `/api/v1/supervisor/conversations/${conversationId}/messages`,
        method: 'GET',
        params: { limit: '50', offset: '0' },
      }),
    enabled: !!conversationId,
    refetchInterval: 5_000,
  });
}

export function useTakeoverConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (conversationId: string) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${conversationId}/takeover`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'conversations'] });
      toast.success(t('toasts.conversations.takenOver'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloseDigitalConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ conversationId, reason }: { conversationId: string; reason?: string }) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${conversationId}/close`,
        method: 'POST',
        data: { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'conversations'] });
      toast.success(t('toasts.conversations.closed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSendCoachingNote() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ conversationId, text }: { conversationId: string; text: string }) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${conversationId}/note`,
        method: 'POST',
        data: { text },
      }),
    onSuccess: () => toast.success(t('toasts.supervisor.coachingNoteSent')),
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── W5 Work Failover — Stuck Work ──────────────────────

/**
 * A conversation owned by an OFFLINE agent that is still in an active state.
 * Some are auto-re-queued by the backend's failover sweep; the `escalated` ones
 * gave up after `failoverAttempts` reached the max and need a manual reassign.
 * `state` is the conversation state on the wire (PascalCase — normalize for display).
 *
 * Server response is the named `StuckConversationDto[]` schema (openapi-response-adoption,
 * Platform/ADR-0035). `failoverAttempts` is now single-typed `number` on the regenerated
 * document (openapi-numeric-schema-truth, Platform/ADR-0036 strips the spurious AOT `string`
 * arm at the source), so the stuck-work UI compares it numerically (`failoverAttempts > 0`)
 * directly off the DTO — the former `Omit & { failoverAttempts: number }` wrapper and its
 * boundary coercion collapse to the generated schema.
 */
export type StuckConversation = components['schemas']['StuckConversationDto'];

export function useStuckConversations() {
  return useQuery({
    queryKey: ['supervisor', 'stuck'],
    queryFn: () =>
      customFetch<components['schemas']['StuckConversationDto'][]>({
        url: '/api/v1/supervisor/conversations/stuck',
        method: 'GET',
      }),
    refetchInterval: 15_000,
  });
}

export type ReassignTarget = { targetQueueId: string } | { targetAgentId: string };

export function useReassignConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('operations');
  return useMutation({
    mutationFn: ({ id, ...target }: { id: string } & ReassignTarget) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${id}/reassign`,
        method: 'POST',
        data: target,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'stuck'] });
      toast.success(t('stuck_work.reassigned_toast'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * W5b voice caller-rescue: re-arms the automatic rescue callback for a VOICE
 * conversation whose callbacks exhausted the retry cap (escalated stuck row).
 */
export function useRetryCallback() {
  const qc = useQueryClient();
  const { t } = useTranslation('operations');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${id}/retry-callback`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'stuck'] });
      toast.success(t('stuck_work.callback_retry_toast'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
