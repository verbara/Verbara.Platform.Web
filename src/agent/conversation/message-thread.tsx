import { useEffect } from 'react';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useMessages } from '@/core/api/hooks/use-conversations';
import { VirtualList } from '@/core/ui/virtual-list';
import { MessageBubble } from './message-bubble';
import { SystemEvent } from './system-event';

const ESTIMATED_MESSAGE_HEIGHT_PX = 64;

export function MessageThread({ conversationId }: { conversationId: string }) {
  const messages = useConversationStore((s) => s.messages[conversationId] ?? []);
  const setMessages = useConversationStore((s) => s.setMessages);

  const { data: fetchedMessages } = useMessages(conversationId);

  useEffect(() => {
    if (fetchedMessages && fetchedMessages.length > 0) {
      setMessages(conversationId, fetchedMessages);
    }
  }, [fetchedMessages, conversationId, setMessages]);

  return (
    <div className="flex-1 px-4 py-4">
      <div className="mx-auto h-full max-w-2xl">
        <VirtualList
          items={messages}
          getItemKey={(msg) => msg.id}
          estimateSize={() => ESTIMATED_MESSAGE_HEIGHT_PX}
          stickToBottom
          renderItem={(msg, idx) => {
            if (msg.type === 'system') {
              return <SystemEvent message={msg} />;
            }
            const prev = messages[idx - 1];
            const showSender = !prev || prev.type === 'system' || prev.sender !== msg.sender;
            return (
              <div className="py-0.5">
                <MessageBubble message={msg} showSender={showSender} />
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
