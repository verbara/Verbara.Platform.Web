import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageBubble } from './message-bubble';
import type { ChatMessage } from './transport/session-api';

export interface MessageListProps {
  readonly messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const { t } = useTranslation('webchat');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = containerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label={t('messages.newMessage')}
      className="flex-1 overflow-y-auto py-3"
    >
      {messages.map((m) => (
        <div key={m.id} className="mb-2">
          <MessageBubble message={m} />
        </div>
      ))}
    </div>
  );
}
