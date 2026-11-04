import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ReadRefusal } from '@/agent/context/read-refusal';
import { useConversationStore, type Message } from '@/agent/stores/conversation-store';
import {
  CONVERSATION_NOT_FOUND_KEY,
  isConversationNotFound,
  isNotReadable,
  refusalCodeOf,
} from '@/core/api/conversation-refusals';
import { useMessageHistory } from '@/core/api/hooks/use-conversations';
import { Button } from '@/core/ui/button';
import { VirtualList } from '@/core/ui/virtual-list';
import { MessageBubble } from './message-bubble';
import { SystemEvent } from './system-event';

const ESTIMATED_MESSAGE_HEIGHT_PX = 64;
/**
 * One stable empty list for a conversation the store has no messages for yet: a fresh `[]` from the
 * selector is a new snapshot on every read, which React rejects with "Maximum update depth exceeded".
 */
const NO_MESSAGES: Message[] = [];

/**
 * A row's list key. A row with no id (a `TypingIndicator` frame, `messageId` `""`) stays in the list, so
 * it takes its position: it holds no state a remount would lose.
 */
function rowKey(message: Message, index: number): string {
  return message.id || `no-id-${index}`;
}

export function MessageThread({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation(['agent', 'common']);
  const messages = useConversationStore((s) => s.messages[conversationId] ?? NO_MESSAGES);
  const mergeMessages = useConversationStore((s) => s.mergeMessages);

  const history = useMessageHistory(conversationId);
  const { messages: served } = history;

  useEffect(() => {
    if (served.length > 0) {
      mergeMessages(conversationId, served);
    }
  }, [served, conversationId, mergeMessages]);

  // A refusal or a 404 takes the thread whatever the fetch phase, over whatever the store holds (spec
  // audit F2, F3). Any other failure leaves the messages on screen.
  const errors = [history.readError, history.nextPageError];
  const refusal = errors.find(isNotReadable);
  const cursorRefused = refusalCodeOf(history.nextPageError) === 'invalid-cursor';

  if (refusal) {
    return (
      <div className="flex-1 px-4 py-4">
        <ReadRefusal error={refusal} />
      </div>
    );
  }

  if (errors.some(isConversationNotFound)) {
    return (
      <div
        data-testid="conversation-not-found"
        className="flex flex-1 items-center justify-center px-4 py-4 text-sm text-slate-500"
      >
        {t(CONVERSATION_NOT_FOUND_KEY)}
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-4">
      <div className="mx-auto flex h-full max-w-2xl flex-col">
        {history.nextPageError && <ReadRefusal error={history.nextPageError} />}
        {history.hasNextPage && !cursorRefused && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            data-testid="history-load-earlier"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {t('agent:history.viewer.load_earlier')}
          </Button>
        )}
        <div className="min-h-0 flex-1">
          <VirtualList
            items={messages}
            getItemKey={rowKey}
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
    </div>
  );
}
