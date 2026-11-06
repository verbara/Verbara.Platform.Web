import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '@/agent/stores/conversation-store';
import { mapPlatformMessage } from '@/core/api/platform-message';
import { historyNewestMessage, historySecondMessage } from '@/tests/utils/contract-doubles';
import { MessageBubble } from './message-bubble';

/**
 * A message exactly as Platform's `GET /api/v1/conversations/{id}/messages` serializes its
 * `Message` record (Verbara.Platform.Conversations/Message.cs): `createdAt`, no `timestamp`.
 * Before 3.20.3-web this reached the bubble unmapped and `format(new Date(undefined))` threw
 * `RangeError: Invalid time value`, taking the whole Agent Workspace down to its error boundary.
 */
const platformShapedMessage = {
  messageId: 'b6c1f3a2d4e54f6a9b8c7d6e5f4a3b2c',
  conversationId: '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c',
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
};

const viewModelMessage: Message = {
  id: 'm1',
  conversationId: 'c1',
  sender: 'customer',
  senderName: 'Ana',
  text: 'Hola',
  timestamp: '2026-10-03T14:05:00Z',
  type: 'text',
};

describe('MessageBubble', () => {
  it('MessageBubble_ShouldNotThrow_WhenMessageCarriesPlatformCreatedAtInsteadOfTimestamp', () => {
    expect(() =>
      render(
        <MessageBubble message={platformShapedMessage as unknown as Message} showSender={false} />,
      ),
    ).not.toThrow();
  });

  it('MessageBubble_ShouldRenderNoTime_WhenTimestampIsNotADate', () => {
    render(<MessageBubble message={{ ...viewModelMessage, timestamp: 'not-a-date' }} showSender />);
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByTestId('message-time')).toBeEmptyDOMElement();
  });

  it('MessageBubble_ShouldRenderTime_WhenTimestampIsValid', () => {
    render(<MessageBubble message={viewModelMessage} showSender />);
    expect(screen.getByTestId('message-time').textContent).toMatch(/\d/);
  });
});

/** The label above a bubble names a side, never the raw stream sender or the stored sender id. */
describe('MessageBubble sender label', () => {
  const agentReply = mapPlatformMessage(historyNewestMessage);
  const customerMessage = mapPlatformMessage(historySecondMessage);
  const OWN_AGENT = String(historyNewestMessage.senderId);

  it('MessageBubble_ShouldNeverShowTheStoredSenderId_WhenTheReplyIsAnotherAgents', () => {
    const { container } = render(<MessageBubble message={agentReply} showSender />);
    expect(container).not.toHaveTextContent(OWN_AGENT);
    expect(screen.getByText('history.direction.outbound')).toBeInTheDocument();
  });

  it('MessageBubble_ShouldLabelTheReplyYou_WhenItIsTheSignedInAgents', () => {
    const { container } = render(
      <MessageBubble message={agentReply} showSender ownAgentId={OWN_AGENT} />,
    );
    expect(container).not.toHaveTextContent(OWN_AGENT);
    expect(screen.getByText('composer.you')).toBeInTheDocument();
  });

  it('MessageBubble_ShouldLabelACustomerMessageWithTheContactName_NeverItsAddress', () => {
    const fromAddress = { ...customerMessage, senderId: '+5215512345678' };
    const { container } = render(
      <MessageBubble message={fromAddress} showSender contactName="Ana Pereira" />,
    );
    expect(container).not.toHaveTextContent('+5215512345678');
    expect(screen.getByText('Ana Pereira')).toBeInTheDocument();
  });

  it.each(['Outbound', 'Inbound'])(
    'MessageBubble_ShouldNeverShowTheStreamSender_WhenALiveRowCarries_%s',
    (sender) => {
      const live: Message = {
        id: 'm-live',
        conversationId: 'c1',
        sender: sender === 'Outbound' ? 'agent' : 'customer',
        senderName: sender,
        text: '',
        pending: true,
        timestamp: '2026-11-03T10:42:07.512+00:00',
        type: 'text',
      };
      const { container } = render(<MessageBubble message={live} showSender />);
      expect(container).not.toHaveTextContent(sender);
    },
  );
});
