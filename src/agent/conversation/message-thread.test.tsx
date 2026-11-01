/**
 * The thread through its real data path: the real `useMessages` hook, the real `customFetch` and the
 * real conversation store, with msw answering the history as Platform does. `MessageBubble` stays a
 * stand-in, so a bubble and a system row can be told apart by what the thread chose to render.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  initConversationSSE,
  useConversationStore,
  type Message,
} from '@/agent/stores/conversation-store';
import { transferNoteMessage } from '@/tests/utils/contract-doubles';
import { MessageThread } from './message-thread';

const { sseHandlers } = vi.hoisted(() => ({
  sseHandlers: {} as Record<string, (data: unknown) => void>,
}));

// The stream itself is not under test: this hands the store's own handler to the test.
vi.mock('@/core/hooks/use-sse', () => ({
  onSseEvent: (type: string, handler: (data: unknown) => void) => {
    sseHandlers[type] = handler;
    return () => undefined;
  },
}));

vi.mock('./message-bubble', () => ({
  MessageBubble: ({ message }: { message: Message }) => (
    <div data-msg-id={message.id}>{message.text}</div>
  ),
}));

const CONVERSATION_ID = String(transferNoteMessage.conversationId);
const NOTE_ID = String(transferNoteMessage.messageId);

const manyMessages: Message[] = Array.from({ length: 200 }, (_, i) => ({
  id: `m${i}`,
  conversationId: CONVERSATION_ID,
  sender: 'agent',
  senderName: 'A',
  text: `Message ${i}`,
  timestamp: new Date(2026, 0, 1, 12, 0, i).toISOString(),
  type: 'text',
}));

/** Fifty customer messages and then the note: the note is the 51st, oldest first. */
const longHistory = [
  ...Array.from({ length: 50 }, (_, i) => ({
    ...transferNoteMessage,
    messageId: `prior-${i}`,
    direction: 'Inbound',
    senderId: null,
    content: { blocks: [{ $type: 'text', text: `Prior ${i}`, type: 'Text' }] },
    createdAt: new Date(Date.UTC(2026, 9, 30, 14, 0, i)).toISOString(),
    createdBy: null,
  })),
  transferNoteMessage,
];

let history: unknown[];
let historyReads: { limit: string | null; offset: string | null }[];

function liveEvent(sender: string, messageId: string, text: string) {
  act(() =>
    sseHandlers['conversation.message']!({
      tenantId: 'demo',
      conversationId: CONVERSATION_ID,
      messageId,
      sender,
      text,
      type: 'conversation.message',
      timestamp: '2026-10-30T15:04:05.130+00:00',
    }),
  );
}

function renderThread(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <div style={{ height: 400 }}>
        <MessageThread conversationId={CONVERSATION_ID} />
      </div>
    </QueryClientProvider>,
  );
}

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const bucket = () => useConversationStore.getState().messages[CONVERSATION_ID] ?? [];

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  initConversationSSE();
});
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  useConversationStore.setState({ messages: {} });
  history = [];
  historyReads = [];
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  server.use(
    http.get(`/api/v1/conversations/${CONVERSATION_ID}/messages`, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const limit = searchParams.get('limit');
      const offset = searchParams.get('offset');
      historyReads.push({ limit, offset });
      const start = Number(offset ?? 0);
      return HttpResponse.json(history.slice(start, start + Number(limit ?? 50)));
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe('MessageThread', () => {
  it('Virtualizes_MessagesList_WhenManyMessages', async () => {
    useConversationStore.setState({ messages: { [CONVERSATION_ID]: manyMessages } });
    const { container } = renderThread(newQueryClient());
    await waitFor(() => expect(historyReads).toHaveLength(1));
    expect(container.querySelector('[data-virtual-scroller]')).toBeTruthy();
    expect(container.querySelectorAll('[data-msg-id]').length).toBeLessThan(200);
    expect(container.querySelectorAll('[data-msg-id]').length).toBeGreaterThan(0);
  });

  it('LiveSystemMessage_ShouldRenderAsASystemRow_NotABubble', async () => {
    const { container } = renderThread(newQueryClient());
    await waitFor(() => expect(historyReads).toHaveLength(1));

    liveEvent('Inbound', 'customer-1', 'Hello');
    liveEvent('System', NOTE_ID, 'A note for the next agent');

    expect(await screen.findByTestId('system-event')).toHaveAttribute('data-message-id', NOTE_ID);
    expect(screen.getByText('A note for the next agent')).toBeInTheDocument();
    expect(container.querySelector(`[data-msg-id="${NOTE_ID}"]`)).toBeNull();
    expect(container.querySelector('[data-msg-id="customer-1"]')).toBeTruthy();
  });

  it('StoredNote_ShouldRenderAsTheSameRow_WhenItIsInTheHistoryPage', async () => {
    history = [transferNoteMessage];
    const { container } = renderThread(newQueryClient());
    expect(await screen.findByTestId('system-event')).toHaveAttribute('data-message-id', NOTE_ID);
    expect(container.querySelector(`[data-msg-id="${NOTE_ID}"]`)).toBeNull();
  });

  /**
   * Pins today's behaviour, not a wanted one: the console reads the first 50 messages, oldest first,
   * so the 51st, a transfer note, is outside the page, and the page replaces what a live event added.
   * Gap B14 of the agent console plan reads the tail of the history; when it lands this test goes
   * red, and that is its job.
   */
  it('History_ShouldHoldTheFirstFiftyAndLoseALiveNote_WhenTheNoteIsThe51st', async () => {
    history = longHistory;
    const queryClient = newQueryClient();
    const first = renderThread(queryClient);

    await waitFor(() => expect(bucket()).toHaveLength(50));
    expect(historyReads).toEqual([{ limit: '50', offset: '0' }]);
    expect(bucket().map((m) => m.id)).toEqual(
      longHistory.slice(0, 50).map((m) => String(m.messageId)),
    );
    expect(bucket().some((m) => m.type === 'system')).toBe(false);
    expect(screen.queryByTestId('system-event')).toBeNull();

    liveEvent('System', NOTE_ID, 'A note for the next agent');
    expect(bucket().at(-1)).toMatchObject({ id: NOTE_ID, type: 'system' });

    first.unmount();
    renderThread(queryClient);

    await waitFor(() => expect(historyReads).toHaveLength(2));
    await waitFor(() => expect(bucket()).toHaveLength(50));
    expect(bucket().some((m) => m.id === NOTE_ID)).toBe(false);
  });
});
