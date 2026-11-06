/**
 * The thread through its real data path: the real `useMessageHistory` hook, the real `customFetch` and
 * the real conversation store, with msw answering `/history` as Platform does. `MessageBubble` stays a
 * stand-in, so a bubble and a system row can be told apart by what the thread chose to render, and
 * `VirtualList` is the real one with its props recorded, so every test checks the keys it received.
 */
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  initConversationSSE,
  useConversationStore,
  type Conversation,
  type Message,
} from '@/agent/stores/conversation-store';
import { CONVERSATION_NOT_FOUND_KEY } from '@/core/api/conversation-refusals';
import {
  conversationMessageFrame,
  historyEmptyPage,
  historyFirstPage,
  historyNewestMessage,
  historyOlderPage,
  historyOldestMessage,
  historySecondMessage,
  historyTransferNotePage,
  invalidCursorRefusal,
  notReadableRefusal,
  transferNoteMessage,
  typingIndicatorFrame,
} from '@/tests/utils/contract-doubles';
import { ConversationPanel } from './conversation-panel';
import { MessageThread } from './message-thread';

const { sseHandlers, listKeys } = vi.hoisted(() => ({
  sseHandlers: {} as Record<string, (data: unknown) => void>,
  listKeys: [] as (string | number)[][],
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

vi.mock('@/core/ui/virtual-list', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/ui/virtual-list')>();
  const RealList = actual.VirtualList as (
    props: ComponentProps<typeof actual.VirtualList>,
  ) => never;
  return {
    ...actual,
    VirtualList: (props: ComponentProps<typeof actual.VirtualList>) => {
      listKeys.push(props.items.map((item, index) => props.getItemKey!(item, index)));
      return <RealList {...props} />;
    },
  };
});

const CONVERSATION_ID = String(historyNewestMessage.conversationId);
const NEWEST_ID = String(historyNewestMessage.messageId);
const SECOND_ID = String(historySecondMessage.messageId);
const OLDEST_ID = String(historyOldestMessage.messageId);
const NOTE_ID = String(transferNoteMessage.messageId);
const CURSOR = String(historyFirstPage.nextBefore);
const HISTORY_KEY = ['messages', CONVERSATION_ID];

const NEWEST_TEXT =
  'Your replacement card has been ordered and should arrive within five business days.';
const SECOND_TEXT = 'My card was blocked after I reported it lost';

const manyMessages: Message[] = Array.from({ length: 200 }, (_, i) => ({
  id: `m${i}`,
  conversationId: CONVERSATION_ID,
  sender: 'agent',
  senderName: 'A',
  text: `Message ${i}`,
  timestamp: new Date(2026, 0, 1, 12, 0, i).toISOString(),
  type: 'text',
}));

const storedRow: Message = {
  id: 'stored-1',
  conversationId: CONVERSATION_ID,
  sender: 'customer',
  senderName: 'Ana',
  text: 'A message the store already holds',
  timestamp: '2026-10-28T09:00:00.000+00:00',
  type: 'text',
};

const openConversation: Conversation = {
  id: CONVERSATION_ID,
  contactId: 'contact-1',
  contactName: 'Ana',
  channel: 'whatsapp',
  queueName: 'Support',
  state: 'active',
  lastMessage: '',
  lastMessageAt: '2026-10-28T09:00:00.000+00:00',
  unread: false,
  assignedAt: '2026-10-28T09:00:00.000+00:00',
};

const page = (body: unknown) => () => HttpResponse.json(body as object);
const refused = (status: number, body: object | null) => () =>
  body === null ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
const NOT_READABLE = refused(403, notReadableRefusal);
const NOT_FOUND = refused(404, null);
const BAD_CURSOR = refused(400, invalidCursorRefusal);

/** A failure that is neither the refusal nor a 404: the thread keeps what it shows. */
const OTHER_FAILURES: [string, () => Response][] = [
  ['500', refused(500, null)],
  ['403 of another code', refused(403, { error: 'not-an-agent' })],
];

/** What `/history` answers now, by page. Replace a member to change the answer of the next read. */
let answers: {
  first: () => Response | Promise<Response>;
  older: () => Response | Promise<Response>;
};
let historyReads: (string | null)[];
let messagesReads: number;

function frame(data: unknown) {
  act(() => sseHandlers['conversation.message']!(data));
}

function liveEvent(sender: string, messageId: string, text: string) {
  frame({ ...conversationMessageFrame, sender, messageId, text });
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
const bucketIds = () => bucket().map((m) => m.id);

/** The store holds the conversation and a message of it, as the panel sees it. */
function holdInStore() {
  useConversationStore.setState({
    conversations: { [CONVERSATION_ID]: openConversation },
    messages: { [CONVERSATION_ID]: [storedRow] },
  });
}

/**
 * A refetch that has reached the screen: `invalidateQueries` resolves before TanStack's notification,
 * so a test that then finds nothing changed would pass without having measured the answer.
 */
async function refetch(queryClient: QueryClient) {
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function loadEarlier() {
  fireEvent.click(await screen.findByTestId('history-load-earlier'));
  await waitFor(() => expect(historyReads).toContain(CURSOR));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  initConversationSSE();
});
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  useConversationStore.setState({ conversations: {}, messages: {} });
  answers = { first: page(historyEmptyPage), older: page(historyOlderPage) };
  historyReads = [];
  messagesReads = 0;
  listKeys.length = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  server.use(
    http.get(`/api/v1/conversations/${CONVERSATION_ID}/history`, ({ request }) => {
      const before = new URL(request.url).searchParams.get('before');
      historyReads.push(before);
      return before === null ? answers.first() : answers.older();
    }),
    http.get(`/api/v1/conversations/${CONVERSATION_ID}/messages`, () => {
      messagesReads++;
      return HttpResponse.json([]);
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
  // W8: `VirtualList` never receives two rows with one key, in any test of this file.
  for (const keys of listKeys) expect(new Set(keys).size).toBe(keys.length);
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
    answers.first = page(historyTransferNotePage);
    const { container } = renderThread(newQueryClient());
    expect(await screen.findByTestId('system-event')).toHaveAttribute('data-message-id', NOTE_ID);
    expect(container.querySelector(`[data-msg-id="${NOTE_ID}"]`)).toBeNull();
  });
});

describe('MessageThread opens on the tail (5.1)', () => {
  it('MessageThread_ShouldShowTheNewestPageAndReadNoMessages_WhenItOpens', async () => {
    answers.first = page(historyFirstPage);
    renderThread(newQueryClient());

    expect(await screen.findByText(NEWEST_TEXT)).toBeInTheDocument();
    expect(bucketIds()).toEqual([SECOND_ID, NEWEST_ID]);
    expect(historyReads).toEqual([null]);
    expect(messagesReads).toBe(0);
    expect(screen.getByTestId('history-load-earlier')).toBeInTheDocument();
  });

  it('MessageThread_ShouldOfferNoLoadEarlier_WhenThereIsNoOlderPage', async () => {
    answers.first = page(historyOlderPage);
    renderThread(newQueryClient());

    await waitFor(() => expect(bucketIds()).toEqual([OLDEST_ID]));
    expect(screen.queryByTestId('history-load-earlier')).toBeNull();
  });

  it('MessageThread_ShouldKeepALiveNote_WhenTheThreadOpensAgain', async () => {
    answers.first = page(historyFirstPage);
    const queryClient = newQueryClient();
    const first = renderThread(queryClient);
    await waitFor(() => expect(bucketIds()).toEqual([SECOND_ID, NEWEST_ID]));

    liveEvent('System', NOTE_ID, 'A note for the next agent');
    first.unmount();
    renderThread(queryClient);

    await waitFor(() => expect(historyReads).toHaveLength(2));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(bucketIds()).toEqual([SECOND_ID, NEWEST_ID, NOTE_ID]);
  });
});

describe('MessageThread with the live stream (5.2)', () => {
  it('MessageThread_ShouldShowTheHistoryContentOnce_WhenTheLiveFrameArrivesAfterThePage', async () => {
    answers.first = page(historyFirstPage);
    const { container } = renderThread(newQueryClient());
    await screen.findByText(NEWEST_TEXT);

    frame(conversationMessageFrame);

    expect(container.querySelectorAll(`[data-msg-id="${NEWEST_ID}"]`)).toHaveLength(1);
    expect(screen.getByText(NEWEST_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('WhatsApp')).toBeNull();
  });

  it('MessageThread_ShouldReplaceTheLiveRow_WhenThePageArrivesAfterTheLiveFrame', async () => {
    const queryClient = newQueryClient();
    const { container } = renderThread(queryClient);
    await waitFor(() => expect(historyReads).toHaveLength(1));
    frame(conversationMessageFrame);
    expect(await screen.findByText('WhatsApp')).toBeInTheDocument();

    answers.first = page(historyFirstPage);
    await refetch(queryClient);

    expect(await screen.findByText(NEWEST_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('WhatsApp')).toBeNull();
    expect(container.querySelectorAll(`[data-msg-id="${NEWEST_ID}"]`)).toHaveLength(1);
  });

  it('MessageThread_ShouldPlaceTheOlderPageAboveAndSendTheCursor_WhenLoadEarlierIsChosen', async () => {
    answers.first = page(historyFirstPage);
    renderThread(newQueryClient());
    await screen.findByText(NEWEST_TEXT);

    await loadEarlier();

    await waitFor(() => expect(bucketIds()).toEqual([OLDEST_ID, SECOND_ID, NEWEST_ID]));
    expect(historyReads).toEqual([null, CURSOR]);
    await waitFor(() => expect(screen.queryByTestId('history-load-earlier')).toBeNull());
  });

  it('MessageThread_ShouldShowALiveMessageOnceAtTheBottom_AfterLoadingEarlier', async () => {
    answers.first = page(historyFirstPage);
    const { container } = renderThread(newQueryClient());
    await screen.findByText(NEWEST_TEXT);
    await loadEarlier();
    await waitFor(() => expect(bucket()).toHaveLength(3));

    liveEvent('Inbound', 'live-1', 'A live message');

    expect(bucketIds()).toEqual([OLDEST_ID, SECOND_ID, NEWEST_ID, 'live-1']);
    expect(container.querySelectorAll('[data-msg-id="live-1"]')).toHaveLength(1);
  });

  it('MessageThread_ShouldDuplicateNothing_WhenTheLoadedPagesAreReadAgain', async () => {
    answers.first = page(historyFirstPage);
    const queryClient = newQueryClient();
    renderThread(queryClient);
    await screen.findByText(NEWEST_TEXT);
    await loadEarlier();
    await waitFor(() => expect(bucket()).toHaveLength(3));

    await refetch(queryClient);

    expect(historyReads).toEqual([null, CURSOR, null, CURSOR]);
    expect(bucketIds()).toEqual([OLDEST_ID, SECOND_ID, NEWEST_ID]);
  });

  it('MessageThread_ShouldDrawNoRow_WhenTwoTypingFramesArrive', async () => {
    answers.first = page(historyFirstPage);
    const { container } = renderThread(newQueryClient());
    await screen.findByText(NEWEST_TEXT);

    frame(typingIndicatorFrame);
    frame(typingIndicatorFrame);

    expect(bucketIds()).toEqual([SECOND_ID, NEWEST_ID]);
    expect(listKeys.at(-1)).toEqual([SECOND_ID, NEWEST_ID]);
    expect(container.querySelectorAll('[data-msg-id=""]')).toHaveLength(0);
  });
});

describe('MessageThread on the filtered stream (5.3)', () => {
  it('MessageThread_ShouldRenderALiveMessageInTheOfferedCard_WhenTheOfferedAgentReceivesIt', async () => {
    act(() =>
      sseHandlers['conversation.offered']!({
        conversationId: CONVERSATION_ID,
        channel: 'WhatsApp',
      }),
    );
    expect(useConversationStore.getState().conversations[CONVERSATION_ID]?.state).toBe('offered');
    renderThread(newQueryClient());
    await waitFor(() => expect(historyReads).toHaveLength(1));

    frame(conversationMessageFrame);

    expect(await screen.findByText('WhatsApp')).toBeInTheDocument();
    expect(bucketIds()).toEqual([NEWEST_ID]);
  });

  it('MessageThread_ShouldShowAMessageTheStreamNeverCarriedOnce_WhenItOpensAfterTheAccept', async () => {
    // The stream carried only the newest message; the page also holds one it never delivered.
    frame(conversationMessageFrame);
    useConversationStore.setState({
      conversations: { [CONVERSATION_ID]: { ...openConversation, state: 'active' } },
    });
    answers.first = page(historyFirstPage);

    const { container } = renderThread(newQueryClient());

    expect(await screen.findByText(SECOND_TEXT)).toBeInTheDocument();
    expect(container.querySelectorAll(`[data-msg-id="${SECOND_ID}"]`)).toHaveLength(1);
    expect(container.querySelectorAll(`[data-msg-id="${NEWEST_ID}"]`)).toHaveLength(1);
  });
});

describe('MessageThread while its first read is pending', () => {
  /** Holds `/history` open until `release` answers it, so a test can look at the pending thread. */
  function holdTheFirstRead() {
    let answer: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    answers.first = () => held;
    return (respond: () => Response) => answer(respond());
  }

  const drawnRows = (container: HTMLElement) => container.querySelectorAll('[data-msg-id]');

  it('MessageThread_ShouldDrawNoStoreRowOnEitherRead_WhenTheConversationIsRefusedAndTheThreadRemounts', async () => {
    holdInStore();
    const release = holdTheFirstRead();
    const qc = newQueryClient();
    const first = renderThread(qc);

    expect(drawnRows(first.container)).toHaveLength(0);
    expect(screen.getByTestId('thread-loading')).toBeInTheDocument();
    await waitFor(() => expect(historyReads).toHaveLength(1));
    expect(drawnRows(first.container)).toHaveLength(0);

    release(NOT_READABLE);
    await screen.findByTestId('read-refusal');
    expect(drawnRows(first.container)).toHaveLength(0);
    first.unmount();

    // The query holds a refusal and no data: remounting reads again, with no error while it does.
    const releaseSecond = holdTheFirstRead();
    const second = renderThread(qc);

    expect(drawnRows(second.container)).toHaveLength(0);
    expect(screen.getByTestId('thread-loading')).toBeInTheDocument();
    await waitFor(() => expect(historyReads).toHaveLength(2));
    expect(drawnRows(second.container)).toHaveLength(0);

    releaseSecond(NOT_READABLE);
    await screen.findByTestId('read-refusal');
    expect(drawnRows(second.container)).toHaveLength(0);
    expect(bucketIds()).toEqual([storedRow.id]);
  });

  it('MessageThread_ShouldDrawTheStoreRows_WhenTheFirstReadIsAllowed', async () => {
    holdInStore();
    const release = holdTheFirstRead();
    const { container } = renderThread(newQueryClient());
    await waitFor(() => expect(historyReads).toHaveLength(1));

    release(page(historyEmptyPage));

    await waitFor(() => expect(drawnRows(container)).toHaveLength(1));
    expect(screen.queryByTestId('thread-loading')).toBeNull();
  });

  it('MessageThread_ShouldKeepALiveMessage_WhenItArrivesDuringTheFirstRead', async () => {
    act(() =>
      sseHandlers['conversation.offered']!({
        conversationId: CONVERSATION_ID,
        channel: 'WhatsApp',
      }),
    );
    const release = holdTheFirstRead();
    const { container } = renderThread(newQueryClient());
    await waitFor(() => expect(historyReads).toHaveLength(1));

    liveEvent('Inbound', 'live-1', 'Hello during the read');
    expect(drawnRows(container)).toHaveLength(0);

    release(page(historyEmptyPage));

    expect(await screen.findByText('Hello during the read')).toBeInTheDocument();
    expect(bucketIds()).toEqual(['live-1']);
  });

  it.each(OTHER_FAILURES)(
    'MessageThread_ShouldLeaveTheStoreRowsOnScreen_WhenTheFirstReadAnswers %s',
    async (_name, failure) => {
      holdInStore();
      const release = holdTheFirstRead();
      const { container } = renderThread(newQueryClient());
      await waitFor(() => expect(historyReads).toHaveLength(1));

      release(failure);

      await waitFor(() => expect(drawnRows(container)).toHaveLength(1));
      expect(screen.queryByTestId('thread-loading')).toBeNull();
    },
  );

  /** The first read failed, the store's rows show, and a second read is now on its way. */
  async function refetchAfterAFailedFirstRead(failure: () => Response) {
    holdInStore();
    answers.first = failure;
    const qc = newQueryClient();
    const view = renderThread(qc);
    await waitFor(() => expect(drawnRows(view.container)).toHaveLength(1));

    const release = holdTheFirstRead();
    act(() => void qc.invalidateQueries({ queryKey: HISTORY_KEY }));
    await waitFor(() => expect(historyReads).toHaveLength(2));
    return { ...view, qc, release };
  }

  describe.each(OTHER_FAILURES)('after a first read that answers %s', (_name, failure) => {
    it('MessageThread_ShouldKeepTheStoreRows_WhileARefetchIsOnItsWay', async () => {
      const { container } = await refetchAfterAFailedFirstRead(failure);

      expect(drawnRows(container)).toHaveLength(1);
      expect(screen.queryByTestId('thread-loading')).toBeNull();
    });

    it('MessageThread_ShouldReplaceTheRowsWithTheRefusal_WhenTheRefetchIsRefused', async () => {
      const { container, release } = await refetchAfterAFailedFirstRead(failure);

      release(NOT_READABLE);

      await screen.findByTestId('read-refusal');
      expect(drawnRows(container)).toHaveLength(0);
    });

    it('MessageThread_ShouldDrawNoRowOnTheNextRead_WhenTheRefetchWasRefused', async () => {
      const { container, qc, release } = await refetchAfterAFailedFirstRead(failure);
      release(NOT_READABLE);
      await screen.findByTestId('read-refusal');

      holdTheFirstRead();
      act(() => void qc.invalidateQueries({ queryKey: HISTORY_KEY }));
      await waitFor(() => expect(historyReads).toHaveLength(3));

      expect(drawnRows(container)).toHaveLength(0);
      expect(screen.getByTestId('thread-loading')).toBeInTheDocument();
    });

    it('MessageThread_ShouldKeepTheRows_WhenTheRefetchFailsTheSameWay', async () => {
      const { container, qc, release } = await refetchAfterAFailedFirstRead(failure);
      expect(qc.isFetching()).toBe(1);

      release(failure);
      await waitFor(() => expect(qc.isFetching()).toBe(0));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(drawnRows(container)).toHaveLength(1);
      expect(screen.queryByTestId('thread-loading')).toBeNull();
    });

    it('MessageThread_ShouldDrawTheServedRows_WhenTheRefetchAnswers', async () => {
      const { release } = await refetchAfterAFailedFirstRead(failure);

      release(page(historyFirstPage));

      expect(await screen.findByText(NEWEST_TEXT)).toBeInTheDocument();
      expect(screen.getByText(storedRow.text)).toBeInTheDocument();
    });

    it('MessageThread_ShouldDrawNoRowOnTheNextFirstRead_WhenTheRefetchWasAnswered', async () => {
      const { container, qc, release } = await refetchAfterAFailedFirstRead(failure);
      release(page(historyFirstPage));
      await screen.findByText(NEWEST_TEXT);

      holdTheFirstRead();
      act(() => void qc.resetQueries({ queryKey: HISTORY_KEY }));
      await waitFor(() => expect(historyReads).toHaveLength(3));

      expect(drawnRows(container)).toHaveLength(0);
      expect(screen.getByTestId('thread-loading')).toBeInTheDocument();
    });

    it('MessageThread_ShouldDrawNoStoreRow_WhenTheThreadRemountsDuringTheSecondRead', async () => {
      holdInStore();
      answers.first = failure;
      const qc = newQueryClient();
      const first = renderThread(qc);
      await waitFor(() => expect(drawnRows(first.container)).toHaveLength(1));
      first.unmount();

      holdTheFirstRead();
      const second = renderThread(qc);
      await waitFor(() => expect(historyReads).toHaveLength(2));

      expect(drawnRows(second.container)).toHaveLength(0);
      expect(screen.getByTestId('thread-loading')).toBeInTheDocument();
    });

    it('MessageThread_ShouldDrawNoStoreRowOfTheNextConversation_WhenItOpensAfterTheFailure', async () => {
      const NEXT_ID = 'next-conversation';
      server.use(http.get(`/api/v1/conversations/${NEXT_ID}/history`, () => new Promise(() => {})));
      holdInStore();
      useConversationStore.setState((state) => ({
        messages: {
          ...state.messages,
          [NEXT_ID]: [{ ...storedRow, id: 'stored-next', conversationId: NEXT_ID }],
        },
      }));
      answers.first = failure;
      const qc = newQueryClient();
      const thread = (id: string) => (
        <QueryClientProvider client={qc}>
          <div style={{ height: 400 }}>
            <MessageThread conversationId={id} />
          </div>
        </QueryClientProvider>
      );
      const { container, rerender } = render(thread(CONVERSATION_ID));
      await waitFor(() => expect(drawnRows(container)).toHaveLength(1));

      rerender(thread(NEXT_ID));

      expect(drawnRows(container)).toHaveLength(0);
      expect(screen.getByTestId('thread-loading')).toBeInTheDocument();
    });
  });
});

describe('MessageThread refusals (5.4, spec audit F2 and F3)', () => {
  function expectRefusalAndNoMessage(container: HTMLElement) {
    expect(screen.getByTestId('read-refusal')).toHaveAttribute('data-refusal', 'not-readable');
    expect(container.querySelector('[data-virtual-scroller]')).toBeNull();
    expect(container.querySelectorAll('[data-msg-id]')).toHaveLength(0);
    expect(screen.queryByTestId('history-load-earlier')).toBeNull();
  }

  function expectNotFoundAndNoMessage(container: HTMLElement) {
    expect(screen.getByTestId('conversation-not-found')).toHaveTextContent(
      CONVERSATION_NOT_FOUND_KEY,
    );
    expect(screen.queryByTestId('read-refusal')).toBeNull();
    expect(container.querySelector('[data-virtual-scroller]')).toBeNull();
    expect(container.querySelectorAll('[data-msg-id]')).toHaveLength(0);
  }

  it('MessageThread_ShouldDrawTheRefusalAndNoStoreMessage_WhenTheFirstPageIsNotReadable', async () => {
    holdInStore();
    answers.first = NOT_READABLE;
    const { container } = renderThread(newQueryClient());

    await screen.findByTestId('read-refusal');

    expectRefusalAndNoMessage(container);
    expect(bucketIds()).toEqual([storedRow.id]);
  });

  it('MessageThread_ShouldDrawTheRefusal_WhenALoadedThreadIsRefusedANextPage', async () => {
    holdInStore();
    answers.first = page(historyFirstPage);
    answers.older = NOT_READABLE;
    const { container } = renderThread(newQueryClient());
    await screen.findByText(NEWEST_TEXT);

    await loadEarlier();

    await screen.findByTestId('read-refusal');
    expectRefusalAndNoMessage(container);
  });

  it('MessageThread_ShouldDrawTheRefusal_WhenALoadedThreadIsRefusedARefetch', async () => {
    holdInStore();
    answers.first = page(historyFirstPage);
    const queryClient = newQueryClient();
    const { container } = renderThread(queryClient);
    await screen.findByText(NEWEST_TEXT);

    answers.first = NOT_READABLE;
    await refetch(queryClient);

    await screen.findByTestId('read-refusal');
    expectRefusalAndNoMessage(container);
  });

  it('MessageThread_ShouldDrawTheMessagesAgain_WhenARefusedRefetchIsAnsweredLater', async () => {
    answers.first = page(historyFirstPage);
    const queryClient = newQueryClient();
    renderThread(queryClient);
    await screen.findByText(NEWEST_TEXT);
    answers.first = NOT_READABLE;
    await refetch(queryClient);
    await screen.findByTestId('read-refusal');

    answers.first = page(historyFirstPage);
    await refetch(queryClient);

    expect(await screen.findByText(NEWEST_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId('read-refusal')).toBeNull();
  });

  it.each(OTHER_FAILURES)(
    'MessageThread_ShouldKeepTheStoreMessagesAndShowNoRefusal_WhenTheFirstPageAnswers %s',
    async (_name, answer) => {
      holdInStore();
      answers.first = answer;
      const queryClient = newQueryClient();
      const { container } = renderThread(queryClient);

      await waitFor(() =>
        expect(queryClient.getQueryState([...HISTORY_KEY, 'history'])?.error).toBeTruthy(),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.queryByTestId('read-refusal')).toBeNull();
      expect(screen.queryByTestId('conversation-not-found')).toBeNull();
      expect(container.querySelector(`[data-msg-id="${storedRow.id}"]`)).toBeTruthy();
    },
  );

  it.each(OTHER_FAILURES)(
    'MessageThread_ShouldKeepTheMessagesAndShowNoRefusal_WhenARefetchAnswers %s',
    async (_name, answer) => {
      answers.first = page(historyFirstPage);
      const queryClient = newQueryClient();
      renderThread(queryClient);
      await screen.findByText(NEWEST_TEXT);

      answers.first = answer;
      await refetch(queryClient);

      expect(queryClient.getQueryState([...HISTORY_KEY, 'history'])?.error).toBeTruthy();
      expect(screen.queryByTestId('read-refusal')).toBeNull();
      expect(screen.getByText(NEWEST_TEXT)).toBeInTheDocument();
    },
  );

  it.each(OTHER_FAILURES)(
    'MessageThread_ShouldKeepTheMessagesAndTheControl_WhenANextPageAnswers %s',
    async (_name, answer) => {
      answers.first = page(historyFirstPage);
      answers.older = answer;
      renderThread(newQueryClient());
      await screen.findByText(NEWEST_TEXT);

      await loadEarlier();

      expect(await screen.findByTestId('read-refusal')).toHaveAttribute(
        'data-refusal',
        'read-failed',
      );
      expect(screen.getByText(NEWEST_TEXT)).toBeInTheDocument();
      expect(screen.getByTestId('history-load-earlier')).toBeInTheDocument();
    },
  );

  it('MessageThread_ShouldKeepTheMessagesAndHideTheControl_WhenTheCursorIsRefused', async () => {
    answers.first = page(historyFirstPage);
    answers.older = BAD_CURSOR;
    renderThread(newQueryClient());
    await screen.findByText(NEWEST_TEXT);

    await loadEarlier();

    expect(await screen.findByTestId('read-refusal')).toHaveAttribute(
      'data-refusal',
      'invalid-cursor',
    );
    expect(screen.getByText(NEWEST_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId('history-load-earlier')).toBeNull();
  });

  it('MessageThread_ShouldShowTheNotFoundText_WhenTheFirstPageAnswers404WithTheConversationInTheStore', async () => {
    holdInStore();
    answers.first = NOT_FOUND;
    const { container } = renderThread(newQueryClient());

    await screen.findByTestId('conversation-not-found');

    expectNotFoundAndNoMessage(container);
    expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toBeDefined();
    expect(bucketIds()).toEqual([storedRow.id]);
  });

  it('MessageThread_ShouldShowTheNotFoundText_WhenARefetchAnswers404', async () => {
    holdInStore();
    answers.first = page(historyFirstPage);
    const queryClient = newQueryClient();
    const { container } = renderThread(queryClient);
    await screen.findByText(NEWEST_TEXT);

    answers.first = NOT_FOUND;
    await refetch(queryClient);

    await screen.findByTestId('conversation-not-found');
    expectNotFoundAndNoMessage(container);
  });

  it('MessageThread_ShouldShowTheNotFoundText_WhenANextPageAnswers404', async () => {
    holdInStore();
    answers.first = page(historyFirstPage);
    answers.older = NOT_FOUND;
    const { container } = renderThread(newQueryClient());
    await screen.findByText(NEWEST_TEXT);

    await loadEarlier();

    await screen.findByTestId('conversation-not-found');
    expectNotFoundAndNoMessage(container);
  });

  describe('inside the panel', () => {
    function renderPanel() {
      return render(
        <QueryClientProvider client={newQueryClient()}>
          <ConversationPanel conversationId={CONVERSATION_ID} />
        </QueryClientProvider>,
      );
    }

    it.each([
      ['the refusal', NOT_READABLE, 'read-refusal'],
      ['the not-found text', NOT_FOUND, 'conversation-not-found'],
    ])(
      'ConversationPanel_ShouldKeepTheComposer_WhenTheThreadShows %s',
      async (_name, answer, id) => {
        holdInStore();
        answers.first = answer;
        renderPanel();

        await screen.findByTestId(id);

        expect(screen.getByRole('textbox')).toBeInTheDocument();
      },
    );

    it('ConversationPanel_ShouldDrawNoThreadAndReadNothing_WhenTheStoreHasNoEntry', () => {
      renderPanel();

      expect(screen.getByTestId('conversation-not-found')).toHaveTextContent(
        CONVERSATION_NOT_FOUND_KEY,
      );
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(historyReads).toEqual([]);
    });
  });
});
