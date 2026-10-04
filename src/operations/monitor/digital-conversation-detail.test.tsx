/**
 * The supervisor's digital-conversation detail reads the same Platform `Message` record from
 * `GET /api/v1/supervisor/conversations/{id}/messages` (SupervisorEndpoints.GetConversationMessages
 * returns `IReadOnlyList<Message>`): `createdAt`, no `timestamp`. `Intl.DateTimeFormat.format` on
 * an Invalid Date throws the same `RangeError: Invalid time value` the agent bubble did. Real hook,
 * real `customFetch`, msw answering as Platform v2.26.0, inside the Operations error boundary.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import { server } from '@/test/msw-server';
import { TEST_LOCALES, type TestLocale } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';
import { AreaErrorBoundary } from '@/core/ui/area-error-boundary';
import type { SupervisorConversation } from '@/core/api/hooks/use-supervisor';
import { DigitalConversationDetail } from './digital-conversation-detail';
import enOperations from '../../../public/locales/en-US/operations.json';
import esOperations from '../../../public/locales/es-419/operations.json';
import ptOperations from '../../../public/locales/pt-BR/operations.json';

const CONVERSATION_ID = '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c';

const conversation: SupervisorConversation = {
  id: CONVERSATION_ID,
  contactId: 'contact-1',
  contactName: 'Ana',
  channel: 'webchat',
  queueName: 'Soporte',
  state: 'active',
  lastMessage: 'Hola, necesito ayuda',
  lastMessageAt: '2026-10-03T14:05:00Z',
  assignedAt: '2026-10-03T14:04:00Z',
};

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
    deliveredAt: null,
    readAt: null,
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
  },
];

const OPERATIONS_LOCALES = { 'en-US': enOperations, 'es-419': esOperations, 'pt-BR': ptOperations };

async function createOperationsI18n(lng: TestLocale) {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    fallbackLng: false,
    resources: { [lng]: { operations: OPERATIONS_LOCALES[lng] } },
    ns: ['operations'],
    defaultNS: 'operations',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  server.use(
    http.get(`/api/v1/supervisor/conversations/${CONVERSATION_ID}/messages`, () =>
      HttpResponse.json(platformMessages),
    ),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe('DigitalConversationDetail message history from Platform', () => {
  it.each(TEST_LOCALES)(
    'DigitalConversationDetail_ShouldRenderHistory_WhenPlatformReturnsStoredMessages (%s)',
    async (lng) => {
      const i18n = await createOperationsI18n(lng);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <AreaErrorBoundary areaName="operations">
              <DigitalConversationDetail conversation={conversation} />
            </AreaErrorBoundary>
          </I18nextProvider>
        </QueryClientProvider>,
      );

      // Wait for the history request to settle into either the thread or the boundary; the
      // boundary's text carries the error message, so a crash reads as itself in the failure.
      await waitFor(() =>
        expect(
          screen.queryByText('Hola, necesito ayuda') ??
            screen.queryByTestId('area-error-boundary-operations'),
        ).not.toBeNull(),
      );
      expect(
        screen.queryByTestId('area-error-boundary-operations')?.textContent ?? null,
      ).toBeNull();
      expect(screen.getByText('Hola, necesito ayuda')).toBeInTheDocument();
      // The stored createdAt, not the render time: an unmapped `timestamp` (undefined) reached
      // `Intl.DateTimeFormat.format` as "now" and showed the wall clock instead.
      const expectedTime = new Intl.DateTimeFormat(lng, { timeStyle: 'short' }).format(
        new Date(platformMessages[0]!.createdAt),
      );
      expect(screen.getByTestId('supervisor-message-time')).toHaveTextContent(expectedTime);
    },
  );
});
