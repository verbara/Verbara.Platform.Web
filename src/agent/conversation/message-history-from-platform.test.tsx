/**
 * Opening a conversation with stored messages, through the real data path: the real `useMessages`
 * hook, the real `customFetch`, the real conversation store, `MessageThread` and `MessageBubble`,
 * inside the Agent area's real error boundary. msw answers
 * `GET /api/v1/conversations/{id}/messages` the way Platform v2.26.0 does — an array of its
 * `Message` record (Verbara.Platform.Conversations/Message.cs, camelCase, string enums,
 * polymorphic `$type` blocks), with `createdAt` and no `timestamp`, `messageId` and no `id`.
 *
 * Platform v2.26.0 fixed the 500 on that endpoint, so the console received history for the first
 * time, and 3.20.2-web crashed with "Invalid time value" in every locale (verbara-lab LAB-W1 d).
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import { server } from '@/test/msw-server';
import { TEST_LOCALES, type TestLocale } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { AreaErrorBoundary } from '@/core/ui/area-error-boundary';
import { MessageThread } from './message-thread';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';

const CONVERSATION_ID = '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c';

const platformMessages = [
  {
    messageId: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
    conversationId: CONVERSATION_ID,
    tenantId: 'tenant-1',
    direction: 'Inbound',
    channel: 'WebChat',
    senderId: null,
    content: { blocks: [{ $type: 'text', text: 'Hola, necesito ayuda', type: 'Text' }] },
    deliveryStatus: 'Delivered',
    externalMessageId: null,
    createdAt: '2026-10-03T14:05:00+00:00',
    deliveredAt: '2026-10-03T14:05:01+00:00',
    readAt: null,
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
  },
  {
    messageId: 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2',
    conversationId: CONVERSATION_ID,
    tenantId: 'tenant-1',
    direction: 'Outbound',
    channel: 'WebChat',
    senderId: 'agent-7',
    content: { blocks: [{ $type: 'text', text: 'Con gusto le ayudo', type: 'Text' }] },
    deliveryStatus: 'Sent',
    externalMessageId: null,
    createdAt: '2026-10-03T14:06:00+00:00',
    deliveredAt: null,
    readAt: null,
    updatedAt: null,
    createdBy: 'agent-7',
    updatedBy: null,
  },
];

const AGENT_LOCALES = { 'en-US': enAgent, 'es-419': esAgent, 'pt-BR': ptAgent };

async function createAgentI18n(lng: TestLocale) {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    fallbackLng: false,
    resources: { [lng]: { agent: AGENT_LOCALES[lng] } },
    ns: ['agent'],
    defaultNS: 'agent',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

let requests = 0;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  requests = 0;
  useAuthStore.getState().logout();
  useConversationStore.setState({ messages: {} });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  server.use(
    http.get(`/api/v1/conversations/${CONVERSATION_ID}/messages`, () => {
      requests++;
      return HttpResponse.json(platformMessages);
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
      const i18n = await createAgentI18n(lng);
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
      expect(await screen.findByText('Hola, necesito ayuda')).toBeInTheDocument();
      expect(screen.getByText('Con gusto le ayudo')).toBeInTheDocument();
      const times = screen.getAllByTestId('message-time');
      expect(times).toHaveLength(2);
      for (const time of times) expect(time.textContent).toMatch(/\d/);
    },
  );
});
