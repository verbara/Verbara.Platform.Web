import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Conversation } from '@/agent/stores/conversation-store';
import { InboxItem } from './inbox-item';

const base: Conversation = {
  id: 'conv-1',
  contactId: 'contact-1',
  contactName: 'Ana',
  channel: 'whatsapp',
  queueName: 'Soporte',
  state: 'active',
  lastMessage: 'Hola',
  lastMessageAt: '2026-10-04T10:05:00.000Z',
  unread: false,
  assignedAt: '2026-10-04T10:00:00.000Z',
};

function renderItem(conversation: Conversation) {
  render(
    <MemoryRouter>
      <InboxItem conversation={conversation} />
    </MemoryRouter>,
  );
}

describe('InboxItem', () => {
  it('InboxItem_ShouldCarryTheConversationIdInItsTestId_WhenRendered', () => {
    renderItem(base);
    expect(screen.getByTestId('inbox-item-conv-1')).toBeInTheDocument();
    expect(screen.getByTestId('inbox-item-time')).toBeInTheDocument();
  });

  // A record without a usable date (Platform's raw `Conversation` has no `lastMessageAt`) rendered
  // `formatDistanceToNow(new Date(undefined))`, which throws "Invalid time value" (LAB-W1 N17).
  it.each([
    ['Missing', undefined],
    ['Empty', ''],
    ['Unparseable', 'not-a-date'],
  ])('InboxItem_ShouldRenderWithoutATime_WhenLastMessageAtIs%s', (_label, lastMessageAt) => {
    renderItem({ ...base, lastMessageAt: lastMessageAt as unknown as string });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByTestId('inbox-item-time')).toBeNull();
  });
});
