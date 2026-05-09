import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageBubble } from './message-bubble';
import type { ChatMessage } from './transport/session-api';

export interface MessageListProps {
  readonly messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const { t } = useTranslation('webchat');
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }
  }, [messages.length, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label={t('messages.newMessage')}
      className="flex-1 overflow-y-auto py-3"
    >
      <div
        style={{
          height: totalSize,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((vi) => {
          const m = messages[vi.index];
          if (!m) return null;
          return (
            <div
              key={m.id}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
              className="mb-2"
            >
              <MessageBubble message={m} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
