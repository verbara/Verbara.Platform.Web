import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  channel: string;
  queueName: string;
  state:
    | 'offered'
    | 'active'
    | 'on_hold'
    | 'consulting'
    | 'queued'
    | 'waiting_for_customer'
    | 'snoozed'
    | 'wrap_up';
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  assignedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: 'agent' | 'customer' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'image' | 'file' | 'system';
  metadata?: Record<string, unknown>;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useConversations(filter?: {
  state?: string;
  queueId?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}) {
  const params: Record<string, string> = {
    page: String(filter?.page ?? 1),
    pageSize: String(filter?.pageSize ?? 50),
  };
  if (filter?.state) params.state = filter.state;
  if (filter?.queueId) params.queueId = filter.queueId;
  if (filter?.agentId) params.agentId = filter.agentId;

  return useQuery({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const result = await customFetch<PagedResult<Conversation>>({
        url: '/api/v1/conversations',
        method: 'GET',
        params,
      });
      return result.items;
    },
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: () =>
      customFetch<Conversation>({
        url: `/api/v1/conversations/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      customFetch<Message[]>({
        url: `/api/v1/conversations/${conversationId}/messages`,
        method: 'GET',
        params: { limit: '50', offset: '0' },
      }),
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, text }: { conversationId: string; text: string }) =>
      customFetch<Message>({
        url: `/api/v1/conversations/${conversationId}/messages`,
        method: 'POST',
        data: { text },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAcceptConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/accept`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('toasts.conversations.accepted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRejectConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/reject`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('toasts.conversations.rejected'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTransferConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; targetQueueId?: string; targetAgentId?: string }) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/transfer`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('toasts.conversations.transferred'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Server result of a blind voice transfer (3B.2c). On success `accepted` is true. */
export interface VoiceTransferResult {
  accepted: boolean;
  error?: string | null;
}

/**
 * Blind-transfer a live VOICE call to a queue or another agent (3B.2c). Distinct from
 * {@link useTransferConversation} (the digital re-queue): the backend redirects the customer's
 * trunk leg via AMI (the browser softphone is a single SIP.js session and cannot REFER), so this
 * is a thin POST. Success/close UX lives in `voice-transfer-dialog` — the agent leg then drops and
 * the existing hangup→wrap-up flow takes over. External targets arrive in 3B.2d.
 */
export function useVoiceTransfer() {
  return useMutation({
    mutationFn: ({
      id,
      kind,
      target,
    }: {
      id: string;
      kind: 'queue' | 'agent' | 'external';
      target: string;
    }) =>
      customFetch<VoiceTransferResult>({
        url: `/api/v1/conversations/${id}/voice-transfer`,
        method: 'POST',
        data: { kind, target },
      }),
  });
}

/** Server result of an agent click-to-dial (3B.2d). On success `correlationId` is the outbound Conversation id. */
export interface VoiceDialResult {
  accepted: boolean;
  correlationId?: string | null;
  error?: string | null;
}

/**
 * Agent click-to-dial (3B.2d): server-side AMI Originate of an outbound call (reusing the Pro Dialer
 * stack — caller-ID, route→trunk, DNC). The Originate rings the agent's OWN softphone leg; the returned
 * `correlationId` (the tracked outbound Conversation id) is handed to `voice-call-store.startOutbound`
 * so the call card shows "Dialing …" optimistically and the softphone auto-answers the agent leg.
 */
export function useVoiceDial() {
  return useMutation({
    mutationFn: ({ toNumber, contactId }: { toNumber?: string; contactId?: string }) =>
      customFetch<VoiceDialResult>({
        url: '/api/v1/voice/dial',
        method: 'POST',
        data: { toNumber, contactId },
      }),
  });
}

export function useCloseConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/close`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('toasts.conversations.closed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useHoldConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/hold`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations', id] });
      toast.success(t('toasts.conversations.onHold'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnholdConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/unhold`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations', id] });
      toast.success(t('toasts.conversations.resumed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { contactId: string; channel: string; initialMessage?: string }) =>
      customFetch<Conversation>({
        url: '/api/v1/conversations',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('toasts.conversations.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
