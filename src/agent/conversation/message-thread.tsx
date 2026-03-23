import { useEffect, useRef } from 'react';
import { useConversationStore, type Message } from '@/agent/stores/conversation-store';
import { MessageBubble } from './message-bubble';
import { SystemEvent } from './system-event';

function buildMockMessages(conversationId: string): Message[] {
  const now = Date.now();
  const m = (
    id: number,
    sender: Message['sender'],
    senderName: string,
    text: string,
    minutesAgo: number,
    overrides?: Partial<Message>,
  ): Message => ({
    id: `${conversationId}-msg-${id}`,
    conversationId,
    sender,
    senderName,
    text,
    timestamp: new Date(now - minutesAgo * 60_000).toISOString(),
    type: 'text',
    status: sender === 'agent' ? 'read' : undefined,
    ...overrides,
  });

  const sets: Record<string, Message[]> = {
    'conv-1': [
      m(1, 'system', 'System', 'Assigned to you from Queue Support', 10, {
        type: 'system',
        metadata: { eventType: 'assigned' },
      }),
      m(2, 'customer', 'Ana Martinez', 'Hi, I need help with my order #4582. It shows as delivered but I never received it.', 9),
      m(3, 'agent', 'You', 'Hello Ana! I\'m sorry to hear that. Let me look into order #4582 for you right away.', 8),
      m(4, 'customer', 'Ana Martinez', 'Thank you, I placed it last week and the tracking says delivered on Monday.', 7),
      m(5, 'agent', 'You', 'I can see the order was shipped via express. The carrier confirmed delivery at your address. Could you check with neighbors or your building reception?', 6, { status: 'delivered' }),
      m(6, 'customer', 'Ana Martinez', 'I already checked, nobody has it. This is frustrating.', 5),
      m(7, 'system', 'System', 'Customer placed on hold', 4, {
        type: 'system',
        metadata: { eventType: 'hold' },
      }),
      m(8, 'system', 'System', 'Customer resumed from hold', 3.5, {
        type: 'system',
        metadata: { eventType: 'resume' },
      }),
      m(9, 'agent', 'You', 'I\'ve opened a claim with the carrier and initiated a replacement shipment for you. You should receive it within 2-3 business days.', 3, { status: 'read' }),
      m(10, 'customer', 'Ana Martinez', 'That works, thank you for helping!', 2),
    ],
    'conv-2': [
      m(1, 'system', 'System', 'Assigned to you from Queue Billing', 45, {
        type: 'system',
        metadata: { eventType: 'assigned' },
      }),
      m(2, 'customer', 'Carlos Rivera', '<p>Hello,</p><p>I need a copy of my <strong>January invoice</strong>. Account number: <em>BIL-29384</em>.</p><p>Thanks,<br/>Carlos</p>', 44, {
        metadata: { contentType: 'html' },
      }),
      m(3, 'agent', 'You', 'Hi Carlos, I found your account. Let me pull up that invoice for you.', 40, { status: 'read' }),
      m(4, 'agent', 'You', 'invoice-january-2026.pdf', 38, {
        type: 'file',
        status: 'delivered',
        metadata: { fileName: 'invoice-january-2026.pdf', fileSize: '245 KB' },
      }),
      m(5, 'customer', 'Carlos Rivera', 'Got it. Could you also send the February one?', 30),
      m(6, 'agent', 'You', 'Sure, I sent the invoice details for February as well. Please confirm when you receive them.', 15, { status: 'read' }),
      m(7, 'system', 'System', 'Waiting for customer response', 15, {
        type: 'system',
        metadata: { eventType: 'hold' },
      }),
    ],
    'conv-3': [
      m(1, 'system', 'System', 'Assigned to you from Queue Sales', 5, {
        type: 'system',
        metadata: { eventType: 'assigned' },
      }),
      m(2, 'customer', 'Laura Chen', 'Hi there! I\'m interested in your enterprise plans.', 4),
      m(3, 'agent', 'You', 'Welcome Laura! We\'d love to help. How large is your team?', 3.5, { status: 'read' }),
      m(4, 'customer', 'Laura Chen', 'We have about 55 agents across 3 locations.', 3),
      m(5, 'agent', 'You', 'For a team of 50+, our Enterprise plan includes unlimited channels, priority support, and custom integrations. Would you like me to schedule a demo?', 2, { status: 'delivered' }),
      m(6, 'customer', 'Laura Chen', 'What plans do you offer for teams of 50+?', 1),
      m(7, 'customer', 'Laura Chen', 'Also, do you support WhatsApp Business API?', 0.5),
    ],
    'conv-4': [
      m(1, 'system', 'System', 'Assigned to you from Queue Support', 20, {
        type: 'system',
        metadata: { eventType: 'assigned' },
      }),
      m(2, 'agent', 'You', 'Hello Pedro, I understand you need a password reset. Let me verify your identity first.', 19, { status: 'read' }),
      m(3, 'customer', 'Pedro Gomez', 'Yes, I\'ve been locked out of my account for two days.', 18),
      m(4, 'agent', 'You', 'I\'ve sent a verification code to your registered email. Can you confirm the 6-digit code?', 17, { status: 'read' }),
      m(5, 'customer', 'Pedro Gomez', 'The code is 482917.', 16),
      m(6, 'agent', 'You', 'Perfect, verified. I\'ve reset your password. You should receive a new temporary password at your email.', 15, { status: 'read' }),
      m(7, 'customer', 'Pedro Gomez', 'Got it, I can log in now. Thanks!', 10),
      m(8, 'system', 'System', 'Call ended — password reset completed successfully', 8, {
        type: 'system',
        metadata: { eventType: 'ended' },
      }),
    ],
    'conv-5': [
      m(1, 'system', 'System', 'Offered to you from Queue Support', 0.5, {
        type: 'system',
        metadata: { eventType: 'assigned' },
      }),
      m(2, 'customer', 'Sofia Nguyen', 'Can someone help me reset my password?', 0.5),
    ],
    'conv-6': [
      m(1, 'system', 'System', 'Assigned to you from Queue Billing', 180, {
        type: 'system',
        metadata: { eventType: 'assigned' },
      }),
      m(2, 'customer', 'Diego Fernandez', 'I have a question about the charge on my last statement.', 175),
      m(3, 'agent', 'You', 'Hi Diego, I can help with that. Which charge are you referring to?', 170, { status: 'read' }),
      m(4, 'customer', 'Diego Fernandez', 'There\'s a $49.99 charge I don\'t recognize from March 10.', 165),
      m(5, 'system', 'System', 'Transferred to Billing Specialist', 160, {
        type: 'system',
        metadata: { eventType: 'transferred' },
      }),
      m(6, 'agent', 'You', 'I\'ve checked and that charge is for the premium add-on you activated on March 8. Would you like me to send the details?', 155, { status: 'read' }),
      m(7, 'customer', 'Diego Fernandez', 'I will check and get back to you tomorrow.', 120),
    ],
  };

  return sets[conversationId] ?? [
    m(1, 'system', 'System', 'Conversation started', 5, {
      type: 'system',
      metadata: { eventType: 'assigned' },
    }),
    m(2, 'customer', 'Customer', 'Hello, I need help.', 4),
    m(3, 'agent', 'You', 'Hi! How can I assist you today?', 3, { status: 'read' }),
  ];
}

export function MessageThread({ conversationId }: { conversationId: string }) {
  const messages = useConversationStore((s) => s.messages[conversationId] ?? []);
  const setMessages = useConversationStore((s) => s.setMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const existing = useConversationStore.getState().messages[conversationId];
    if (!existing || existing.length === 0) {
      setMessages(conversationId, buildMockMessages(conversationId));
    }
  }, [conversationId, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
        {messages.map((msg, idx) => {
          if (msg.type === 'system') {
            return <SystemEvent key={msg.id} message={msg} />;
          }

          const prev = messages[idx - 1];
          const showSender =
            !prev || prev.type === 'system' || prev.sender !== msg.sender;

          return <MessageBubble key={msg.id} message={msg} showSender={showSender} />;
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
