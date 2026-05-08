import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { Message } from '@/agent/stores/conversation-store';
import { MessageThread } from './message-thread';

const mockMessages: Message[] = Array.from({ length: 200 }, (_, i) => ({
  id: `m${i}`,
  conversationId: 'c1',
  sender: 'agent',
  senderName: 'A',
  text: `Message ${i}`,
  timestamp: new Date(2026, 0, 1, 12, 0, i).toISOString(),
  type: 'text',
}));

vi.mock('@/agent/stores/conversation-store', async () => {
  const actual = await vi.importActual<typeof import('@/agent/stores/conversation-store')>(
    '@/agent/stores/conversation-store',
  );
  return {
    ...actual,
    useConversationStore: <T,>(
      selector: (s: { messages: Record<string, Message[]>; setMessages: () => void }) => T,
    ): T =>
      selector({
        messages: { c1: mockMessages },
        setMessages: () => undefined,
      }),
  };
});

vi.mock('@/core/api/hooks/use-conversations', () => ({
  useMessages: () => ({ data: undefined }),
}));

vi.mock('./message-bubble', () => ({
  MessageBubble: ({ message }: { message: Message }) => (
    <div data-msg-id={message.id}>{message.text}</div>
  ),
}));

vi.mock('./system-event', () => ({
  SystemEvent: ({ message }: { message: Message }) => <div data-system-id={message.id} />,
}));

describe('MessageThread', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Virtualizes_MessagesList_WhenManyMessages', () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <MessageThread conversationId="c1" />
      </div>,
    );
    expect(container.querySelector('[data-virtual-scroller]')).toBeTruthy();
    expect(container.querySelectorAll('[data-msg-id]').length).toBeLessThan(200);
    expect(container.querySelectorAll('[data-msg-id]').length).toBeGreaterThan(0);
  });
});
