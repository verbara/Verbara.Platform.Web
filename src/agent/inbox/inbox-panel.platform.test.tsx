/**
 * The agent inbox, with the real conversation store, the real `useConversations` hook and real
 * `customFetch`, msw answering `GET /api/v1/conversations` as Platform v2.25.0+ does: a
 * `PagedResult<Conversation>` of raw `Conversation` records (`conversationId`, PascalCase `state`,
 * `createdAt`/`updatedAt`, no `id`, no `lastMessageAt`). LAB-W1 N17: before 3.21.0-web the REST path
 * upserted that record unmapped (keyed `undefined`, a state no filter matches, and a missing date that
 * `formatDistanceToNow` throws on), and the list did not re-render when a conversation arrived by SSE
 * (0 rows until a tab switch). Only the panel's peripheral widgets are stubbed.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import type { components } from '@/core/api/generated/openapi';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { InboxPanel } from './inbox-panel';

vi.mock('@/core/api/hooks/use-agents', () => ({
  useAgentMe: () => ({ data: { id: 'agent-1' } }),
}));
vi.mock('./inbox-filters', () => ({ InboxFilters: () => <div /> }));
vi.mock('./inbox-empty', () => ({ InboxEmpty: () => <div data-testid="inbox-empty" /> }));
vi.mock('./agent-status-selector', () => ({ AgentStatusSelector: () => <div /> }));
vi.mock('./new-conversation-dialog', () => ({ NewConversationDialog: () => <div /> }));

const CONVERSATION_ID = '3e4f5a6b7c8d4e9f0a1b2c3d4e5f6a7b';

const platformConversation: components['schemas']['Conversation'] = {
  conversationId: CONVERSATION_ID,
  tenantId: 'tenant-1',
  contactId: '1a2b3c4d5e6f4a7b8c9d0e1f2a3b4c5d',
  channel: 'WhatsApp',
  owner: { kind: 'Agent', ownerId: 'agent-1' },
  state: 'Active',
  caseId: null,
  createdAt: '2026-10-04T10:00:00+00:00',
  closedAt: null,
  updatedAt: '2026-10-04T10:05:00+00:00',
  createdBy: null,
  updatedBy: null,
  voiceLinkedId: null,
  queuePriority: 0,
  metadata: null,
  sessions: [],
};

let restItems: components['schemas']['Conversation'][] = [];
let restRequests = 0;

const i18n = i18next.createInstance();
void i18n.init({
  lng: 'en-US',
  fallbackLng: false,
  resources: {
    'en-US': {
      agent: {
        inbox: {
          title: 'Inbox',
          unknownContact: 'Unknown contact',
          announceNew: 'New conversation from {{name}}',
        },
      },
    },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  useConversationStore.setState({
    conversations: {},
    messages: {},
    selectedId: null,
    filter: 'active',
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
  restItems = [];
  restRequests = 0;
  server.use(
    http.get('/api/v1/conversations', () => {
      restRequests += 1;
      return HttpResponse.json({
        items: restItems,
        totalCount: restItems.length,
        page: 1,
        pageSize: 50,
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

function renderInbox() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <div style={{ height: 400 }}>
            <InboxPanel />
          </div>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('InboxPanel with Platform conversations', () => {
  it('InboxPanel_ShouldListTheConversationUnderItsPlatformId_WhenRestAnswersARawConversation', async () => {
    restItems = [platformConversation];
    renderInbox();

    await waitFor(() =>
      expect(Object.keys(useConversationStore.getState().conversations)).toHaveLength(1),
    );
    expect(Object.keys(useConversationStore.getState().conversations)).toEqual([CONVERSATION_ID]);
    expect(await screen.findByTestId(`inbox-item-${CONVERSATION_ID}`)).toBeInTheDocument();
    expect(screen.queryByTestId('inbox-empty')).toBeNull();
  });

  it('InboxPanel_ShouldRenderTheNewRow_WhenTheStoreGainsAConversation', async () => {
    const queryClient = renderInbox();
    // Let the REST list settle first, as it has long before an SSE event arrives in a real session;
    // otherwise the query's own resolution re-renders the panel and hides the bug.
    await waitFor(() => expect(restRequests).toBe(1));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(await screen.findByTestId('inbox-empty')).toBeInTheDocument();

    // What the `conversation.assigned` SSE handler does: upsert into the store, nothing else.
    act(() => {
      useConversationStore.getState().upsertConversation({
        id: 'sse-conv-1',
        contactId: '',
        contactName: 'Ana',
        channel: 'whatsapp',
        queueName: 'Soporte',
        state: 'offered',
        lastMessage: '',
        lastMessageAt: '2026-10-04T10:06:00.000Z',
        unread: true,
        assignedAt: '2026-10-04T10:06:00.000Z',
      });
    });

    await waitFor(() => expect(screen.queryByTestId('inbox-empty')).toBeNull());
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('InboxPanel_ShouldKeepTheSseFields_WhenTheRestListRefetchesTheSameConversation', async () => {
    const queryClient = renderInbox();
    await waitFor(() => expect(restRequests).toBe(1));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // `conversation.assigned` delivered the conversation with what Platform's REST record lacks.
    act(() => {
      useConversationStore.getState().upsertConversation({
        id: CONVERSATION_ID,
        contactId: '',
        contactName: 'Ana',
        channel: 'whatsapp',
        queueName: 'Soporte',
        state: 'offered',
        lastMessage: 'Hola, necesito ayuda',
        lastMessageAt: '2026-10-04T10:01:00.000Z',
        unread: true,
        assignedAt: '2026-10-04T10:01:00.000Z',
      });
    });
    expect(await screen.findByText('Ana')).toBeInTheDocument();

    // The REST list refetches (focus, invalidation, interval) and now carries the same id.
    restItems = [platformConversation];
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    await waitFor(() => expect(restRequests).toBe(2));
    await waitFor(() =>
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]?.state).toBe('active'),
    );

    const conv = useConversationStore.getState().conversations[CONVERSATION_ID];
    expect(conv).toMatchObject({
      contactId: platformConversation.contactId,
      contactName: 'Ana',
      queueName: 'Soporte',
      lastMessage: 'Hola, necesito ayuda',
      unread: true,
      state: 'active',
      lastMessageAt: platformConversation.updatedAt,
    });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Hola, necesito ayuda')).toBeInTheDocument();
  });

  it('InboxPanel_ShouldNameAnUnknownContact_WhenOnlyTheRestRecordIsKnown', async () => {
    restItems = [platformConversation];
    renderInbox();

    const row = await screen.findByTestId(`inbox-item-${CONVERSATION_ID}`);
    expect(row).toHaveTextContent('Unknown contact');
  });

  it('InboxPanel_ShouldAnnounceAnUnknownContact_WhenTheNewestConversationHasNoName', async () => {
    restItems = [platformConversation];
    renderInbox();
    await screen.findByTestId(`inbox-item-${CONVERSATION_ID}`);

    act(() => {
      useConversationStore.getState().upsertConversation({
        id: 'sse-conv-2',
        contactId: '',
        contactName: '',
        channel: 'whatsapp',
        queueName: '',
        state: 'offered',
        lastMessage: '',
        lastMessageAt: '2099-01-01T00:00:00.000Z',
        unread: true,
        assignedAt: '2099-01-01T00:00:00.000Z',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'New conversation from Unknown contact',
    );
  });
});
