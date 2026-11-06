/**
 * A live message as the agent sees it: the real `MessageThread` and the real `MessageBubble`, rendered
 * with the app's own query client (the singleton the store's stream handler refreshes), msw answering
 * `/history` as Platform does. No test triggers a refresh itself: every `/history` read after the first
 * is one the live frame caused.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';
import { createLocaleI18n, TEST_LOCALES } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';
import { queryClient } from '@/core/api/query-client';
import { initConversationSSE, useConversationStore } from '@/agent/stores/conversation-store';
import {
  conversationMessageFrame,
  historyEmptyPage,
  historyFirstPage,
  historyNewestMessage,
} from '@/tests/utils/contract-doubles';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';
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

const PLACEHOLDER = {
  'en-US': enAgent.thread.messagePending,
  'es-419': esAgent.thread.messagePending,
  'pt-BR': ptAgent.thread.messagePending,
} as const;

const CONVERSATION_ID = String(historyNewestMessage.conversationId);
const NEWEST_ID = String(historyNewestMessage.messageId);
const NEWEST_TEXT =
  'Your replacement card has been ordered and should arrive within five business days.';

type Answer = () => Response | Promise<Response>;

/** What the next `/history` read answers. */
let nextAnswer: Answer;
let historyReads: number;

const page = (body: unknown) => () => HttpResponse.json(body as object);

/** Holds the next `/history` read open until the returned function answers it. */
function holdTheNextRead() {
  let answer: (response: Response) => void = () => undefined;
  const held = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  nextAnswer = () => held;
  return (respond: Answer) => answer(respond() as Response);
}

function frame(data: unknown) {
  act(() => sseHandlers['conversation.message']!(data));
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderThread(lng: (typeof TEST_LOCALES)[number] = 'en-US') {
  const i18n = await createLocaleI18n(lng);
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <div style={{ height: 400 }}>
          <MessageThread conversationId={CONVERSATION_ID} />
        </div>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelectorAll(`[data-testid="message-bubble"][data-message-id="${id}"]`);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  initConversationSSE();
});
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  useConversationStore.setState({ conversations: {}, messages: {} });
  queryClient.clear();
  nextAnswer = page(historyEmptyPage);
  historyReads = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  server.use(
    http.get(`/api/v1/conversations/${CONVERSATION_ID}/history`, () => {
      historyReads++;
      const answer = nextAnswer;
      nextAnswer = page(historyEmptyPage);
      return answer();
    }),
  );
});

afterEach(async () => {
  cleanup();
  await settle();
  queryClient.clear();
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe('A live message in the open thread', () => {
  it.each(TEST_LOCALES)(
    'LiveMessage_ShouldShowThePlaceholderUntilTheHistoryReadFillsIt_In_%s',
    async (lng) => {
      const { container } = await renderThread(lng);
      await waitFor(() => expect(historyReads).toBe(1));
      await waitFor(() => expect(screen.queryByTestId('thread-loading')).toBeNull());

      const release = holdTheNextRead();
      frame(conversationMessageFrame);

      const pending = rowOf(container, NEWEST_ID);
      expect(pending).toHaveLength(1);
      expect(pending[0]).toHaveAttribute('data-msg-pending');
      expect(pending[0]).toHaveTextContent(PLACEHOLDER[lng]);
      expect(screen.queryByText('WhatsApp')).toBeNull();
      await waitFor(() => expect(historyReads).toBe(2));

      release(page(historyFirstPage));

      expect(await screen.findByText(NEWEST_TEXT)).toBeInTheDocument();
      const filled = rowOf(container, NEWEST_ID);
      expect(filled).toHaveLength(1);
      expect(filled[0]).not.toHaveAttribute('data-msg-pending');
      expect(screen.queryByText(PLACEHOLDER[lng])).toBeNull();
      expect(container.querySelectorAll('[data-msg-pending]')).toHaveLength(0);
    },
  );

  it('LiveMessage_ShouldBeReadAgain_WhenItArrivesWhileTheFirstReadIsInFlight', async () => {
    const releaseFirst = holdTheNextRead();
    const { container } = await renderThread();
    await waitFor(() => expect(historyReads).toBe(1));

    frame(conversationMessageFrame);
    // The first read was answered before the message was stored: it does not hold it.
    releaseFirst(page(historyEmptyPage));
    nextAnswer = page(historyFirstPage);

    await waitFor(() => expect(historyReads).toBe(2));
    expect(await screen.findByText(NEWEST_TEXT)).toBeInTheDocument();
    expect(rowOf(container, NEWEST_ID)).toHaveLength(1);
    expect(container.querySelectorAll('[data-msg-pending]')).toHaveLength(0);
  });

  it('LiveMessages_ShouldCauseOneFurtherRead_WhenTheyArriveInABurstDuringARefresh', async () => {
    await renderThread();
    await waitFor(() => expect(historyReads).toBe(1));
    await waitFor(() => expect(screen.queryByTestId('thread-loading')).toBeNull());

    const release = holdTheNextRead();
    frame({ ...conversationMessageFrame, sender: 'Inbound', messageId: 'live-1' });
    await waitFor(() => expect(historyReads).toBe(2));
    frame({ ...conversationMessageFrame, sender: 'Inbound', messageId: 'live-2' });
    frame({ ...conversationMessageFrame, sender: 'Inbound', messageId: 'live-3' });
    frame({ ...conversationMessageFrame, sender: 'Inbound', messageId: 'live-4' });
    await settle();
    expect(historyReads).toBe(2);

    release(page(historyEmptyPage));

    await waitFor(() => expect(historyReads).toBe(3));
    await settle();
    expect(historyReads).toBe(3);
  });
});
