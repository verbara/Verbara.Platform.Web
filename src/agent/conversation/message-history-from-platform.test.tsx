/**
 * Opening a conversation with stored messages, through the real data path: the real
 * `useMessageHistory` hook, the real `customFetch`, the real conversation store, `MessageThread` and
 * `MessageBubble`, inside the Agent area's real error boundary. msw answers
 * `GET /api/v1/conversations/{id}/history` with the host fixture's first page: Platform's `Message`
 * record (Verbara.Platform.Conversations/Message.cs, camelCase, string enums, polymorphic `$type`
 * blocks), with `createdAt` and no `timestamp`, `messageId` and no `id`.
 *
 * Platform v2.26.0 fixed the 500 on that endpoint, so the console received history for the first
 * time, and 3.20.2-web crashed with "Invalid time value" in every locale (verbara-lab LAB-W1 d).
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw-server';
import { createLocaleI18n, TEST_LOCALES } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { AreaErrorBoundary } from '@/core/ui/area-error-boundary';
import { historyFirstPage, historyNewestMessage } from '@/tests/utils/contract-doubles';
import { ConversationPanel } from './conversation-panel';
import { MessageThread } from './message-thread';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';

const CONVERSATION_ID = String(historyNewestMessage.conversationId);

const NOT_FOUND_TEXT = {
  'en-US': enCommon.errors.supervisor_listen.conversation_not_found,
  'es-419': esCommon.errors.supervisor_listen.conversation_not_found,
  'pt-BR': ptCommon.errors.supervisor_listen.conversation_not_found,
};

let requests = 0;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  requests = 0;
  useAuthStore.getState().logout();
  useConversationStore.setState({ messages: {} });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  server.use(
    http.get(`/api/v1/conversations/${CONVERSATION_ID}/history`, () => {
      requests++;
      return HttpResponse.json(historyFirstPage);
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe('Agent Workspace message history from Platform', () => {
  it.each(TEST_LOCALES)(
    'MessageThread_ShouldRenderHistoryWithTimes_WhenPlatformReturnsStoredMessages (%s)',
    async (lng) => {
      const i18n = await createLocaleI18n(lng);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <AreaErrorBoundary areaName="agent">
              <div style={{ height: 400 }}>
                <MessageThread conversationId={CONVERSATION_ID} />
              </div>
            </AreaErrorBoundary>
          </I18nextProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => expect(requests).toBe(1));
      await act(async () => {
        for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // The boundary's text carries the error message, so a crash reads as itself in the failure.
      expect(screen.queryByTestId('area-error-boundary-agent')?.textContent ?? null).toBeNull();
      expect(
        await screen.findByText('My card was blocked after I reported it lost'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your replacement card has been ordered and should arrive within five business days.',
        ),
      ).toBeInTheDocument();
      const times = screen.getAllByTestId('message-time');
      expect(times).toHaveLength(2);
      for (const time of times) expect(time.textContent).toMatch(/\d/);
    },
  );

  it.each(TEST_LOCALES)(
    'MessageThread_ShouldSayNotFoundInTheAgentsLanguage_WhenTheHistoryAnswers404 (%s)',
    async (lng) => {
      server.use(
        http.get(
          `/api/v1/conversations/${CONVERSATION_ID}/history`,
          () => new HttpResponse(null, { status: 404 }),
        ),
      );
      const i18n = await createLocaleI18n(lng);
      render(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <I18nextProvider i18n={i18n}>
            <MessageThread conversationId={CONVERSATION_ID} />
          </I18nextProvider>
        </QueryClientProvider>,
      );

      expect(await screen.findByTestId('conversation-not-found')).toHaveTextContent(
        NOT_FOUND_TEXT[lng],
      );
    },
  );

  it.each(TEST_LOCALES)(
    'ConversationPanel_ShouldSayNotFoundInTheAgentsLanguage_WhenTheStoreHasNoEntry (%s)',
    async (lng) => {
      useConversationStore.setState({ conversations: {} });
      const i18n = await createLocaleI18n(lng);
      render(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <I18nextProvider i18n={i18n}>
            <ConversationPanel conversationId={CONVERSATION_ID} />
          </I18nextProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByText(NOT_FOUND_TEXT[lng])).toHaveAttribute(
        'data-testid',
        'conversation-not-found',
      );
      expect(requests).toBe(0);
    },
  );
});
