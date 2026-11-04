import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type Query,
} from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { mapPlatformMessage } from '@/core/api/platform-message';
import {
  mapPlatformConversation,
  mapPlatformPastConversation,
} from '@/core/api/platform-conversation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CONVERSATION_NOT_CLOSABLE,
  conversationRefusals,
  refusalCodeOf,
} from '@/core/api/conversation-refusals';
import { toastApiError } from '@/core/api/toast-api-error';

/**
 * Kept hand-written (openapi-typed-client-agent): the document's `Conversation` is the raw ENTITY
 * (`conversationId`, `owner`, `sessions`, PascalCase `state`) — a different shape from this inbox
 * view-model (`id`, lowercase `state`, `contactName`/`queueName`/`lastMessage`/`unread`/`assignedAt`),
 * so there is no structurally compatible schema to swap onto. The wire entity is mapped onto it at
 * the data boundary by `mapPlatformConversation`.
 */
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

/**
 * Kept hand-written (openapi-typed-client-agent): the document's `Message` is the raw ENTITY
 * (`messageId`, `direction`, `content` MessageEnvelope, `deliveryStatus`) — not this view-model
 * (`sender`/`senderName`/`text`/`timestamp`/`type`), so there is no structural match to swap onto.
 * The wire entity is mapped onto it at the data boundary by `mapPlatformMessage`.
 */
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
      const result = await customFetch<components['schemas']['PagedResultOfConversation']>({
        url: '/api/v1/conversations',
        method: 'GET',
        params,
      });
      return result.items.map(mapPlatformConversation).filter((c): c is Conversation => c !== null);
    },
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: async () =>
      mapPlatformPastConversation(
        await customFetch<components['schemas']['Conversation']>({
          url: `/api/v1/conversations/${id}`,
          method: 'GET',
        }),
      ),
    enabled: !!id,
  });
}

type MessageHistoryPage = components['schemas']['MessageHistoryPageDto'];

/** The loaded pages as one transcript, oldest at the top, each `messageId` once. */
function transcriptOf(data: InfiniteData<MessageHistoryPage, string | undefined>): Message[] {
  const seen = new Set<string>();
  const newestFirst: Message[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      const id = String(item.messageId);
      if (seen.has(id)) continue;
      seen.add(id);
      newestFirst.push(mapPlatformMessage(item));
    }
  }
  return newestFirst.reverse();
}

const NO_MESSAGES: Message[] = [];

/**
 * A conversation's transcript, newest page first (`GET /api/v1/conversations/{id}/history`), for any
 * state. `fetchNextPage` reads the next older page with the page's `nextBefore`, sent back untouched
 * as `before`. The key sits under `['messages', id]`, so that invalidation reaches it, and a refetch
 * reads every loaded page again.
 *
 * `readError` is a refused read of the transcript; `nextPageError` is a refused "load earlier", which
 * leaves the loaded messages in place. Only one of the two is ever set.
 */
export function useMessageHistory(conversationId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['messages', conversationId, 'history'],
    queryFn: ({ pageParam }) =>
      customFetch<MessageHistoryPage>({
        url: `/api/v1/conversations/${conversationId}/history`,
        method: 'GET',
        ...(pageParam !== undefined ? { params: { before: pageParam } } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextBefore ?? undefined) : undefined,
    select: transcriptOf,
    enabled: !!conversationId,
  });
  return {
    messages: query.data ?? NO_MESSAGES,
    isLoaded: query.data !== undefined,
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    readError: query.isFetchNextPageError ? null : query.error,
    nextPageError: query.isFetchNextPageError ? query.error : null,
  };
}

export function useSendMessage() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: async ({ conversationId, text }: { conversationId: string; text: string }) =>
      mapPlatformMessage(
        await customFetch<components['schemas']['Message']>({
          url: `/api/v1/conversations/${conversationId}/messages`,
          method: 'POST',
          data: { text },
        }),
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
    },
    onError: (err: Error) => toastApiError(err, conversationRefusals, t, { action: 'send' }),
  });
}

/** `['contacts', contactId, 'conversations']`, the key of `useContactConversations`, for any contact. */
function isContactConversationsQuery({ queryKey }: Query) {
  return queryKey.length === 3 && queryKey[0] === 'contacts' && queryKey[2] === 'conversations';
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
      // Accepting opens the contact's history to the agent (a mounted History tab sits on its 403 until
      // then) and changes `heldByCaller`. The mutation knows the conversation, not its contact.
      qc.invalidateQueries({ predicate: isContactConversationsQuery });
      toast.success(t('toasts.conversations.accepted'));
    },
    onError: (err: Error) => toastApiError(err, conversationRefusals, t, { action: 'accept' }),
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
    onError: (err: Error) => toastApiError(err, conversationRefusals, t, { action: 'reject' }),
  });
}

export function useTransferConversation() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<components['schemas']['TransferRequest']>) =>
      customFetch<void>({
        url: `/api/v1/conversations/${id}/transfer`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('toasts.conversations.transferred'));
    },
    onError: (err: Error) => toastApiError(err, conversationRefusals, t, { action: 'transfer' }),
  });
}

/**
 * Server result of a blind voice transfer (3B.2c). On success `accepted` is true.
 * Migrated to the generated schema (openapi-typed-client-agent, Platform/ADR-0035):
 * `VoiceTransferResponse` is a structural match; no consumer reads its fields.
 */
export type VoiceTransferResult = components['schemas']['VoiceTransferResponse'];

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

/**
 * Server result of an agent click-to-dial (3B.2d). On success `correlationId` is the outbound Conversation id.
 * Migrated to the generated schema (openapi-typed-client-agent, Platform/ADR-0035):
 * `VoiceDialResponse` is a structural match (`accepted`/`correlationId` read by contact-info are present).
 */
export type VoiceDialResult = components['schemas']['VoiceDialResponse'];

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
    // Every refusal is toasted. `conversation-not-closable` means the console's view of the state is
    // stale, so the conversation queries refetch; `typification-required` is the caller's to act on
    // (the conversation panel opens the wrap-up sheet) — see `useCloseConversationAction`.
    onError: (err: Error, id) => {
      toastApiError(err, conversationRefusals, t, { action: 'close' });
      if (refusalCodeOf(err) === CONVERSATION_NOT_CLOSABLE) {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['conversations', id] });
      }
    },
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
    onError: (err: Error) => toastApiError(err, conversationRefusals, t, { action: 'hold' }),
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
    onError: (err: Error) => toastApiError(err, conversationRefusals, t, { action: 'unhold' }),
  });
}

/** `POST /conversations` body (Platform 2.28.0 `CreateConversationRequest`). */
export type CreateConversationInput = components['schemas']['CreateConversationRequest'];

/**
 * Starts a conversation in the calling agent's name (Platform 2.28.0, spec agent-started-conversations).
 * Answers the raw `Conversation` entity: a 201 for a new conversation and for the reuse of the
 * caller's own open one alike. A refusal is reported as a toast unless `reportErrors` is `'inline'`,
 * for a caller that shows the refusal itself (the new-conversation dialog, which acts on the
 * refusal's `conversationId`).
 */
export function useCreateConversation(options: { reportErrors?: 'toast' | 'inline' } = {}) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const reportErrors = options.reportErrors ?? 'toast';
  return useMutation({
    mutationFn: (data: CreateConversationInput) =>
      customFetch<components['schemas']['Conversation']>({
        url: '/api/v1/conversations',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(t('toasts.conversations.created'));
    },
    onError: (err: Error) => {
      if (reportErrors === 'toast')
        toastApiError(err, conversationRefusals, t, { action: 'create' });
    },
  });
}
