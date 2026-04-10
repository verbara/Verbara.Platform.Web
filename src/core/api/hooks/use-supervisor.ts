import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
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
  return useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      customFetch<void>({
        url: `/api/v1/supervisor/sessions/${sessionId}/whisper`,
        method: 'POST',
        data: { message },
      }),
    onSuccess: () => toast.success('Whisper sent'),
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
  return useMutation({
    mutationFn: (conversationId: string) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${conversationId}/takeover`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'conversations'] });
      toast.success('Conversation taken over');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloseDigitalConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, reason }: { conversationId: string; reason?: string }) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${conversationId}/close`,
        method: 'POST',
        data: { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'conversations'] });
      toast.success('Conversation closed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSendCoachingNote() {
  return useMutation({
    mutationFn: ({ conversationId, text }: { conversationId: string; text: string }) =>
      customFetch<void>({
        url: `/api/v1/supervisor/conversations/${conversationId}/note`,
        method: 'POST',
        data: { text },
      }),
    onSuccess: () => toast.success('Coaching note sent'),
    onError: (err: Error) => toast.error(err.message),
  });
}
