import { create } from 'zustand';
import { onSseEvent } from '@/core/hooks/use-sse';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import { useAgentAiStore } from '@/agent/stores/agent-ai-store';

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
  metadata?: Record<string, string>;
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

export type ConversationFilter = 'active' | 'waiting' | 'wrapup';

interface ConversationState {
  conversations: Record<string, Conversation>;
  messages: Record<string, Message[]>;
  selectedId: string | null;
  filter: ConversationFilter;
  select: (id: string) => void;
  setFilter: (f: ConversationFilter) => void;
  upsertConversation: (conv: Conversation) => void;
  removeConversation: (id: string) => void;
  addMessage: (convId: string, message: Message) => void;
  setMessages: (convId: string, messages: Message[]) => void;
  markRead: (convId: string) => void;
  filteredConversations: () => Conversation[];
}

const filterStates: Record<ConversationFilter, Conversation['state'][]> = {
  active: ['offered', 'active', 'on_hold', 'consulting'],
  waiting: ['queued', 'waiting_for_customer', 'snoozed'],
  wrapup: ['wrap_up'],
};

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: {},
  messages: {},
  selectedId: null,
  filter: 'active',

  select: (id) => set({ selectedId: id }),

  setFilter: (f) => set({ filter: f }),

  upsertConversation: (conv) =>
    set((s) => ({
      conversations: { ...s.conversations, [conv.id]: conv },
    })),

  removeConversation: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.conversations;
      const { [id]: __, ...restMessages } = s.messages;
      return {
        conversations: rest,
        messages: restMessages,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  addMessage: (convId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: [...(s.messages[convId] ?? []), message],
      },
    })),

  setMessages: (convId, messages) =>
    set((s) => ({
      messages: { ...s.messages, [convId]: messages },
    })),

  markRead: (convId) =>
    set((s) => {
      const conv = s.conversations[convId];
      if (!conv) return s;
      return {
        conversations: {
          ...s.conversations,
          [convId]: { ...conv, unread: false },
        },
      };
    }),

  filteredConversations: () => {
    const { conversations, filter } = get();
    const allowed = filterStates[filter];
    return Object.values(conversations)
      .filter((c) => allowed.includes(c.state))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  },
}));

let sseInitialized = false;

export function initConversationSSE() {
  if (sseInitialized) return;
  sseInitialized = true;

  const store = useConversationStore.getState();

  onSseEvent('conversation.assigned', (data) => {
    const event = data as {
      conversationId: string;
      contactName: string;
      channel: string;
      queueName: string;
    };
    store.upsertConversation({
      id: event.conversationId,
      contactId: '',
      contactName: event.contactName,
      channel: event.channel,
      queueName: event.queueName,
      state: 'offered',
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unread: true,
      assignedAt: new Date().toISOString(),
    });
  });

  onSseEvent('conversation.offered', (data) => {
    const event = data as { conversationId: string; channel: string };
    const existing = useConversationStore.getState().conversations[event.conversationId];
    store.upsertConversation({
      id: event.conversationId,
      contactId: existing?.contactId ?? '',
      contactName: existing?.contactName ?? '',
      channel: event.channel,
      queueName: existing?.queueName ?? '',
      state: 'offered',
      lastMessage: existing?.lastMessage ?? '',
      lastMessageAt: existing?.lastMessageAt ?? new Date().toISOString(),
      unread: true,
      assignedAt: new Date().toISOString(),
    });
  });

  // Inbound voice call answered (3B.1): upsert the tracked voice Conversation so the panel +
  // ContextPanel (contact/history) hydrate, and correlate the live softphone call. Spread-merge
  // over any existing record so we never wipe contactId/queueName (the P1 blank-inbox lesson).
  onSseEvent('voice.screenpop', (data) =>
    applyVoiceScreenPop(
      data as {
        conversationId: string;
        contactId: string;
        contactName: string;
        callerNumber: string;
        queueAutoAnswerDefault?: boolean;
      },
    ),
  );

  onSseEvent('conversation.message', (data) => {
    const event = data as {
      conversationId: string;
      messageId: string;
      sender: string;
      text: string;
      timestamp: string;
    };
    store.addMessage(event.conversationId, {
      id: event.messageId,
      conversationId: event.conversationId,
      sender: event.sender === 'agent' ? 'agent' : 'customer',
      senderName: event.sender,
      text: event.text,
      timestamp: event.timestamp,
      type: 'text',
    });
  });

  onSseEvent('conversation.state_changed', (data) => {
    const event = data as { conversationId: string; newState: string };
    const existing = useConversationStore.getState().conversations[event.conversationId];
    if (!existing) return;

    // The server sends the ConversationState enum name (PascalCase, e.g. "Active"/"WrapUp"); the
    // store uses lowercase/snake states. Map it (a raw cast would store an invalid state that no
    // filter matches — a latent bug the voice WrapUp transition would otherwise hit). Terminal
    // states (Closed/Abandoned/…) drop the conversation from the agent's working set.
    const mapped = mapServerConversationState(event.newState);
    if (mapped === 'terminal') {
      store.removeConversation(event.conversationId);
      // Release the per-conversation agent-assist session too (3B.1 Phase C). Without this the
      // keyed store would accumulate the suggestions/sentiment/transcript of every closed
      // conversation for the lifetime of the tab. WrapUp is NOT terminal, so the transcript stays
      // available while the agent dispositions the call.
      useAgentAiStore.getState().clearSession(event.conversationId);
    } else if (mapped) {
      store.upsertConversation({ ...existing, state: mapped });
    }
  });
}

/**
 * Applies a voice screen-pop event: spread-merge-upserts the tracked voice Conversation (so the panel
 * + ContextPanel hydrate, never wiping an existing record's contactId/queueName — the P1 blank-inbox
 * lesson) and correlates the live softphone call. Exported for direct unit testing (the SSE handlers
 * are registered once behind initConversationSSE's module guard). The right ContextPanel is synced
 * via the route→selectedId effect in conversation-view (the auto-nav fires after this).
 */
export function applyVoiceScreenPop(event: {
  conversationId: string;
  contactId: string;
  contactName: string;
  callerNumber: string;
  queueAutoAnswerDefault?: boolean;
}): void {
  const store = useConversationStore.getState();
  const existing = store.conversations[event.conversationId];
  store.upsertConversation({
    id: event.conversationId,
    contactId: event.contactId || existing?.contactId || '',
    contactName: event.contactName || existing?.contactName || '',
    channel: 'voice',
    queueName: existing?.queueName ?? '',
    state: 'active',
    lastMessage: existing?.lastMessage ?? '',
    lastMessageAt: existing?.lastMessageAt ?? new Date().toISOString(),
    unread: existing?.unread ?? false,
    assignedAt: existing?.assignedAt ?? new Date().toISOString(),
    metadata: existing?.metadata,
  });
  useVoiceCallStore.getState().associateConversation({
    conversationId: event.conversationId,
    callerName: event.contactName,
    callerNumber: event.callerNumber,
    queueAutoAnswerDefault: event.queueAutoAnswerDefault,
  });
}

/** Maps the server ConversationState enum name (PascalCase) to the client store state. */
const SERVER_STATE_TO_CLIENT: Record<string, Conversation['state'] | undefined> = {
  Queued: 'queued',
  Offered: 'offered',
  Active: 'active',
  OnHold: 'on_hold',
  Consulting: 'consulting',
  WaitingForCustomer: 'waiting_for_customer',
  Snoozed: 'snoozed',
  WrapUp: 'wrap_up',
};

/**
 * Server states that take the conversation OUT of the agent's working set. Escalated/Resolved are
 * not "live" agent states (the agent loses ownership: Active→Escalated→Queued, Active→Resolved); the
 * terminal closed/merged/spam states likewise. Dropping them keeps the inbox filters correct (a raw
 * cast of an unmapped name would store a state no filter matches — review finding #16).
 */
const TERMINAL_SERVER_STATES = new Set([
  'Resolved',
  'Closed',
  'Abandoned',
  'Merged',
  'Spam',
  'Escalated',
]);

/**
 * Normalizes a server ConversationState enum name to the client store state: a mapped live state,
 * `'terminal'` (the conversation should be dropped), or `null` (unknown — ignore). The server sends
 * PascalCase enum names; a raw cast would store an invalid state that no inbox filter matches.
 */
export function mapServerConversationState(
  serverState: string,
): Conversation['state'] | 'terminal' | null {
  const mapped = SERVER_STATE_TO_CLIENT[serverState];
  if (mapped) return mapped;
  if (TERMINAL_SERVER_STATES.has(serverState)) return 'terminal';
  return null;
}
