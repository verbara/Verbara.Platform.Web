import { useEffect, useRef } from 'react';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useMessages } from '@/core/api/hooks/use-conversations';
import { MessageBubble } from './message-bubble';
import { SystemEvent } from './system-event';

export function MessageThread({ conversationId }: { conversationId: string }) {
  const messages = useConversationStore((s) => s.messages[conversationId] ?? []);
  const setMessages = useConversationStore((s) => s.setMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: fetchedMessages } = useMessages(conversationId);

  useEffect(() => {
    if (fetchedMessages && fetchedMessages.length > 0) {
      setMessages(conversationId, fetchedMessages);
    }
  }, [fetchedMessages, conversationId, setMessages]);

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
