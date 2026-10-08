/**
 * The supervisor's digital monitor reads `GET /api/v1/supervisor/conversations`, which answers
 * Platform's `PagedResult<Conversation>` (SupervisorEndpoints.ListDigitalConversations): each item is
 * the raw `Conversation` record — `conversationId`, `contactId`, PascalCase `channel` and `state`,
 * `createdAt`/`updatedAt` — with no `id`. Before 3.21.0-web the cards read `id`, so every card was
 * `digital-conv-card-undefined`, the detail opened nothing and a takeover posted to
 * `/supervisor/conversations/undefined/takeover` (LAB-W1 N16). Real hooks, real `customFetch`, msw
 * answering as Platform v2.25.0+.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import type { components } from '@/core/api/generated/openapi';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { DigitalMonitorTab } from './digital-monitor-tab';
import enOperations from '../../../public/locales/en-US/operations.json';

const CONVERSATION_ID = '7c1d2e3f4a5b4c6d8e9f0a1b2c3d4e5f';

const platformConversation: components['schemas']['Conversation'] = {
  conversationId: CONVERSATION_ID,
  tenantId: 'tenant-1',
  contactId: '1a2b3c4d5e6f4a7b8c9d0e1f2a3b4c5d',
  channel: 'WebChat',
  owner: { kind: 'Agent', ownerId: '9f8e7d6c5b4a4c3d2e1f0a9b8c7d6e5f' },
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

async function createOperationsI18n() {
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'en-US',
    fallbackLng: false,
    resources: { 'en-US': { operations: enOperations } },
    ns: ['operations'],
    defaultNS: 'operations',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

let takeoverUrls: string[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  takeoverUrls = [];
  server.use(
    http.get('/api/v1/supervisor/conversations', () =>
      HttpResponse.json({ items: [platformConversation], totalCount: 1, page: 1, pageSize: 25 }),
    ),
    http.get('/api/v1/supervisor/conversations/:id/messages', () => HttpResponse.json([])),
    http.post('/api/v1/supervisor/conversations/:id/takeover', ({ request }) => {
      takeoverUrls.push(new URL(request.url).pathname);
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

async function renderTab() {
  const i18n = await createOperationsI18n();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <DigitalMonitorTab />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('DigitalMonitorTab with Platform conversations', () => {
  it('DigitalMonitorTab_ShouldKeyEachCardByPlatformConversationId_WhenListLoads', async () => {
    await renderTab();

    expect(await screen.findByTestId(`digital-conv-card-${CONVERSATION_ID}`)).toBeInTheDocument();
    expect(screen.queryByTestId('digital-conv-card-undefined')).toBeNull();
  });

  it('DigitalMonitorTab_ShouldOpenDetailAndTakeOverThatConversation_WhenCardClicked', async () => {
    await renderTab();

    // The list's first card, whatever its test id: the takeover URL is what this test pins.
    const list = await screen.findByTestId('digital-conversations-list');
    fireEvent.click(await within(list).findByRole('button'));
    expect(await screen.findByTestId('digital-conversation-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('digital-takeover-btn'));
    fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(takeoverUrls).toHaveLength(1));
    expect(takeoverUrls[0]).toBe(`/api/v1/supervisor/conversations/${CONVERSATION_ID}/takeover`);
  });
});
