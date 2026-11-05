import { useTranslation } from 'react-i18next';
import { MessageBubble } from '@/agent/conversation/message-bubble';
import { SystemEvent } from '@/agent/conversation/system-event';
import {
  isConversationNotFound,
  isNotReadable,
  refusalCodeOf,
} from '@/core/api/conversation-refusals';
import { useConversation, useMessageHistory } from '@/core/api/hooks/use-conversations';
import type { PastConversation } from '@/core/api/platform-conversation';
import { channelLabel } from '@/core/i18n/channel-label';
import { useFormatDate } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { Skeleton } from '@/core/ui/skeleton';
import { VirtualList } from '@/core/ui/virtual-list';
import { closedReasonLabelKey, stateLabelKey } from './history-labels';
import { IdentityLevelMark } from './identity-level-mark';
import { ReadRefusal } from './read-refusal';

const ESTIMATED_MESSAGE_HEIGHT_PX = 64;

/** `metadata` reaches this header as `closedReason` alone (W6): nothing else of it is ever shown. */
function ViewerHeaderDetails({ conversation }: { conversation: PastConversation }) {
  const { t } = useTranslation(['agent']);
  const { formatDate } = useFormatDate();
  const stateKey = stateLabelKey(conversation.wireState);
  const closedReasonKey = conversation.closedReason
    ? closedReasonLabelKey(conversation.closedReason)
    : null;
  return (
    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
      <div className="flex flex-wrap items-center gap-x-2">
        <span data-testid="history-viewer-channel" className="font-medium">
          {channelLabel(t, conversation.channel)}
        </span>
        {stateKey && <span data-testid="history-viewer-state">{t(stateKey)}</span>}
        {closedReasonKey && (
          <span data-testid="history-viewer-closed-reason">{t(closedReasonKey)}</span>
        )}
      </div>
      <dl className="flex flex-wrap gap-x-3">
        <div className="flex gap-1">
          <dt>{t('agent:history.viewer.created_at')}</dt>
          <dd data-testid="history-viewer-created-at">{formatDate(conversation.createdAt)}</dd>
        </div>
        {conversation.closedAt && (
          <div className="flex gap-1">
            <dt>{t('agent:history.viewer.closed_at')}</dt>
            <dd data-testid="history-viewer-closed-at">{formatDate(conversation.closedAt)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * A past conversation, read only (W5): the record for the header, `/history` for the transcript, and
 * no control that writes. It reads nothing from the conversation store and writes nothing to it. The
 * `Sheet` around it belongs to the History tab, so it opens before this chunk has loaded. The level comes
 * from that tab too, and its mark stands whatever the reads below answer (W7).
 */
export function PastConversationViewer({
  conversationId,
  identityLevel,
}: {
  conversationId: string;
  identityLevel: string | undefined;
}) {
  const { t } = useTranslation(['agent']);
  const record = useConversation(conversationId);
  const history = useMessageHistory(conversationId);

  // A refusal or a 404 takes the viewer whatever is cached (spec audit F2, F3), as in the live thread.
  // Any other failure only counts when there is nothing loaded to keep showing.
  const errors = [record.error, history.readError, history.nextPageError];
  const failure =
    errors.find(isNotReadable) ??
    errors.find(isConversationNotFound) ??
    (record.data ? null : record.error) ??
    (history.isLoaded ? null : history.readError);

  const { messages } = history;
  const cursorRefused = refusalCodeOf(history.nextPageError) === 'invalid-cursor';

  return (
    <div
      data-testid="history-viewer"
      data-conversation-id={conversationId}
      data-state={failure ? undefined : record.data?.wireState}
      className="flex h-full min-h-0 flex-col"
    >
      <SheetHeader className="pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle>{t('agent:history.viewer.title')}</SheetTitle>
          <IdentityLevelMark identityLevel={identityLevel} />
        </div>
        {!failure && record.data && <ViewerHeaderDetails conversation={record.data} />}
      </SheetHeader>

      {failure ? (
        <ReadRefusal error={failure} />
      ) : history.isLoading ? (
        <div data-testid="history-viewer-loading" className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : messages.length === 0 ? (
        <div
          data-testid="history-viewer-empty"
          className="flex items-center justify-center p-6 text-sm text-slate-500"
        >
          {t('agent:history.viewer.no_messages')}
        </div>
      ) : (
        <>
          {history.nextPageError && <ReadRefusal error={history.nextPageError} />}
          {history.hasNextPage && !cursorRefused && (
            <div className="px-4 pb-2">
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
            </div>
          )}
          <div className="min-h-0 flex-1 px-4 pb-4">
            <VirtualList
              items={messages}
              getItemKey={(message) => message.id}
              estimateSize={() => ESTIMATED_MESSAGE_HEIGHT_PX}
              stickToBottom
              renderItem={(message, index) => {
                const previous = messages[index - 1];
                return (
                  <div data-testid="history-viewer-message" data-message-id={message.id}>
                    {message.type === 'system' ? (
                      <SystemEvent message={message} />
                    ) : (
                      <div className="py-0.5">
                        <MessageBubble
                          message={message}
                          showSender={
                            !previous ||
                            previous.type === 'system' ||
                            previous.sender !== message.sender
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
