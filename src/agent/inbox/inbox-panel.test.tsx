import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import type { Conversation } from '@/agent/stores/conversation-store';
import { InboxPanel } from './inbox-panel';

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      agent: {
        inbox: {
          title: 'Inbox',
          aria: { newConversation: 'New' },
        },
      },
    },
  },
});

const mockConversations: Conversation[] = Array.from({ length: 200 }, (_, i) => ({
  id: `c${i}`,
  contactId: `co${i}`,
  contactName: `Contact ${i}`,
  channel: 'web',
  queueName: 'Sales',
  state: 'active',
  lastMessage: 'hello',
  lastMessageAt: new Date(2026, 0, 1, 12, 0, i).toISOString(),
  unread: false,
  assignedAt: new Date(2026, 0, 1, 12, 0, i).toISOString(),
}));

vi.mock('@/agent/stores/conversation-store', async () => {
  const actual = await vi.importActual<typeof import('@/agent/stores/conversation-store')>(
    '@/agent/stores/conversation-store',
  );
  return {
    ...actual,
    useConversationStore: <T,>(
      selector: (s: {
        upsertConversation: () => void;
        filter: string;
        filteredConversations: () => Conversation[];
      }) => T,
    ): T =>
      selector({
        upsertConversation: () => undefined,
        filter: 'active',
        filteredConversations: () => mockConversations,
      }),
  };
});

vi.mock('@/core/api/hooks/use-conversations', () => ({
  useConversations: () => ({ data: [] }),
}));
vi.mock('@/core/api/hooks/use-agents', () => ({
  useAgentMe: () => ({ data: { id: 'a1' } }),
}));
vi.mock('./inbox-filters', () => ({ InboxFilters: () => <div /> }));
vi.mock('./inbox-item', () => ({
  InboxItem: ({ conversation }: { conversation: Conversation }) => (
    <div data-conv-id={conversation.id} />
  ),
}));
vi.mock('./inbox-empty', () => ({ InboxEmpty: () => <div /> }));
vi.mock('./agent-status-selector', () => ({ AgentStatusSelector: () => <div /> }));
vi.mock('./new-conversation-dialog', () => ({ NewConversationDialog: () => <div /> }));

describe('InboxPanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Virtualizes_InboxList_WhenManyConversations', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <div style={{ height: 400 }}>
          <InboxPanel />
        </div>
      </I18nextProvider>,
    );
    expect(container.querySelector('[data-virtual-scroller]')).toBeTruthy();
    const items = container.querySelectorAll('[data-conv-id]');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(200);
  });
});
