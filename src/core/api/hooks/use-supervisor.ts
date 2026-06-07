import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

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
 */
export interface StuckConversation {
  conversationId: string;
  channel: string;
  state: string;
  ownerAgentId: string;
  ownerAgentName: string;
  ownerOfflineSince: string | null;
  failoverAttempts: number;
  escalated: boolean;
}

export function useStuckConversations() {
  return useQuery({
    queryKey: ['supervisor', 'stuck'],
    queryFn: () =>
      customFetch<StuckConversation[]>({
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
