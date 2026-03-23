import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import { InboxFilters } from './inbox-filters';
import { InboxItem } from './inbox-item';
import { InboxEmpty } from './inbox-empty';

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    contactId: 'c-101',
    contactName: 'Ana Martinez',
    channel: 'whatsapp',
    queueName: 'support',
    state: 'active',
    lastMessage: 'Hi, I need help with my order #4582. It shows as delivered but I never received it.',
    lastMessageAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    unread: true,
    assignedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    id: 'conv-2',
    contactId: 'c-102',
    contactName: 'Carlos Rivera',
    channel: 'email',
    queueName: 'billing',
    state: 'waiting_for_customer',
    lastMessage: 'I sent the invoice details, please confirm when you receive them.',
    lastMessageAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    unread: false,
    assignedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
  },
  {
    id: 'conv-3',
    contactId: 'c-103',
    contactName: 'Laura Chen',
    channel: 'webchat',
    queueName: 'sales',
    state: 'active',
    lastMessage: 'What plans do you offer for teams of 50+?',
    lastMessageAt: new Date(Date.now() - 1 * 60_000).toISOString(),
    unread: true,
    assignedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'conv-4',
    contactId: 'c-104',
    contactName: 'Pedro Gomez',
    channel: 'voice',
    queueName: 'support',
    state: 'wrap_up',
    lastMessage: 'Call ended - password reset completed successfully.',
    lastMessageAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    unread: false,
    assignedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  },
  {
    id: 'conv-5',
    contactId: 'c-105',
    contactName: 'Sofia Nguyen',
    channel: 'sms',
    queueName: 'support',
    state: 'offered',
    lastMessage: 'Can someone help me reset my password?',
    lastMessageAt: new Date(Date.now() - 30_000).toISOString(),
    unread: true,
    assignedAt: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    id: 'conv-6',
    contactId: 'c-106',
    contactName: 'Diego Fernandez',
    channel: 'telegram',
    queueName: 'billing',
    state: 'snoozed',
    lastMessage: 'I will check and get back to you tomorrow.',
    lastMessageAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    unread: false,
    assignedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
];

export function InboxPanel() {
  const { t } = useTranslation(['agent']);
  const upsertConversation = useConversationStore((s) => s.upsertConversation);
  const filter = useConversationStore((s) => s.filter);
  const filteredConversations = useConversationStore((s) => s.filteredConversations);

  useEffect(() => {
    for (const conv of MOCK_CONVERSATIONS) {
      upsertConversation(conv);
    }
  }, [upsertConversation]);

  const conversations = filteredConversations();

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('agent:inbox.title')}
        </span>
      </div>

      <InboxFilters />

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <InboxEmpty filter={filter} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {conversations.map((conv) => (
              <InboxItem key={conv.id} conversation={conv} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
