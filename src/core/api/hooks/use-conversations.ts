import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
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
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/accept`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation accepted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRejectConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/reject`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation rejected');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTransferConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      targetQueueId?: string;
      targetAgentId?: string;
    }) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/transfer`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation transferred');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/close`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation closed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useWrapUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      dispositionId?: string;
      campaignDispositionId?: number;
      notes?: string;
      callbackDate?: string;
      callbackPhone?: string;
    }) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/wrapup`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Wrap-up completed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
