import { create } from 'zustand';
import { onSseEvent } from '@/core/hooks/use-sse';

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
    const existing = store.conversations[event.conversationId];
    if (existing) {
      store.upsertConversation({
        ...existing,
        state: event.newState as Conversation['state'],
      });
    }
  });
}
