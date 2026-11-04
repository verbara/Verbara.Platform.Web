import { lazy, Suspense, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, MessageSquare, User, XIcon } from 'lucide-react';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { isConversationNotFound, isNotReadable } from '@/core/api/conversation-refusals';
import type { components } from '@/core/api/generated/openapi';
import { useContactConversations } from '@/core/api/hooks/use-contacts';
import { useConversation } from '@/core/api/hooks/use-conversations';
import { channelLabel } from '@/core/i18n/channel-label';
import { useFormatDate } from '@/core/i18n/use-format';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Sheet, SheetClose, SheetContent } from '@/core/ui/sheet';
import { Skeleton } from '@/core/ui/skeleton';
import { blockTypeLabelKey, closedReasonLabelKey, stateLabelKey } from './history-labels';
import { ReadRefusal } from './read-refusal';
import { ViewerLoadBoundary } from './viewer-load-boundary';

// Out of the console's first load (W5): the agent-closure guard measures it, and this is its chunk.
const PastConversationViewer = lazy(() =>
  import('./past-conversation-viewer').then((m) => ({ default: m.PastConversationViewer })),
);

type Summary = components['schemas']['ContactConversationSummaryDto'];

/** The duration as served: Platform already measures a system close to the last activity (W3). */
function useFormatDuration() {
  const { t } = useTranslation(['agent']);
  return (total: number) => {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) return t('agent:history.duration.hours_minutes', { hours, minutes });
    if (minutes === 0) return t('agent:history.duration.seconds', { seconds });
    return seconds === 0
      ? t('agent:history.duration.minutes', { minutes })
      : t('agent:history.duration.minutes_seconds', { minutes, seconds });
  };
}

function LastMessage({ lastMessage }: { lastMessage: NonNullable<Summary['lastMessage']> }) {
  const { t } = useTranslation(['agent']);
  const blockTypeKey = blockTypeLabelKey(lastMessage.blockType);
  const text =
    lastMessage.preview !== '' ? lastMessage.preview : blockTypeKey ? t(blockTypeKey) : null;
  if (text === null) return null;
  const prefix =
    lastMessage.direction === 'Inbound'
      ? t('agent:history.direction.inbound')
      : lastMessage.direction === 'Outbound'
        ? t('agent:history.direction.outbound')
        : null;
  return (
    <span
      data-testid="history-last-message"
      className="block truncate text-xs text-slate-500 dark:text-slate-400"
    >
      {prefix && <span className="font-medium">{prefix}: </span>}
      <span>{text}</span>
    </span>
  );
}

/** Spans only: a past conversation's row is a `<button>`, which holds phrasing content. */
function RowContent({ item }: { item: Summary }) {
  const { t } = useTranslation(['agent']);
  const { formatDate, formatRelative } = useFormatDate();
  const formatDuration = useFormatDuration();
  const stateKey = stateLabelKey(item.state);
  const closedReasonKey = item.closedReason ? closedReasonLabelKey(item.closedReason) : null;
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
          <span>{channelLabel(t, item.channel)}</span>
          {item.heldByCaller && (
            <Badge variant="secondary" data-testid="history-held-mark">
              {t('agent:history.held')}
            </Badge>
          )}
        </span>
        <span
          data-testid="history-time"
          title={formatDate(item.createdAt)}
          className="text-xs text-slate-500"
        >
          {formatRelative(item.lastMessageAt)}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600 dark:text-slate-300">
        {stateKey && <span data-testid="history-state">{t(stateKey)}</span>}
        {closedReasonKey && <span data-testid="history-closed-reason">{t(closedReasonKey)}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
        {item.queueName && (
          <span data-testid="history-queue" className="flex items-center gap-1">
            <MessageSquare size={12} />
            <span>{item.queueName}</span>
          </span>
        )}
        {item.agentDisplayName && (
          <span data-testid="history-agent" className="flex items-center gap-1">
            <User size={12} />
            <span>{item.agentDisplayName}</span>
          </span>
        )}
        {item.durationSeconds != null && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            <span data-testid="history-duration">{formatDuration(item.durationSeconds)}</span>
          </span>
        )}
      </span>
      {item.disposition?.label && (
        <span
          data-testid="history-disposition"
          className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300"
        >
          {item.disposition.label}
        </span>
      )}
      {item.lastMessage && <LastMessage lastMessage={item.lastMessage} />}
    </>
  );
}

function HistoryRow({ item, onOpen }: { item: Summary; onOpen: (id: string) => void }) {
  const selectors = {
    'data-testid': 'history-row',
    'data-conversation-id': item.id,
    'data-held-by-caller': String(item.heldByCaller),
    'data-state': item.state,
  } satisfies ComponentProps<'div'> & Record<`data-${string}`, string>;
  const layout = 'block w-full space-y-1 px-4 py-3 text-left';
  // The conversation the agent holds is already open in the workspace: marked, in place, inert (W4).
  if (item.heldByCaller) {
    return (
      <div {...selectors} className={layout}>
        <RowContent item={item} />
      </div>
    );
  }
  return (
    <button
      type="button"
      {...selectors}
      onClick={() => onOpen(item.id)}
      className={`${layout} hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-slate-700/30`}
    >
      <RowContent item={item} />
    </button>
  );
}

export function ConversationHistory() {
  const { t } = useTranslation(['agent']);
  const selectedId = useConversationStore((s) => s.selectedId);
  const conversation = useConversationStore((s) =>
    selectedId ? s.conversations[selectedId] : undefined,
  );
  // The past conversation in the viewer, and the selection it was opened from (W5).
  const [viewing, setViewing] = useState<{ id: string; openedFrom: string } | null>(null);

  // A fresh offer reaches the store with no contact id, so it comes from the record (W14). The store
  // is left as it is: the inbox contract does not change.
  const storedContactId = conversation?.contactId || undefined;
  const record = useConversation(
    conversation && !storedContactId && selectedId ? selectedId : undefined,
  );
  const contactId = storedContactId ?? record.data?.contactId;
  const list = useContactConversations(contactId);

  // A refusal takes the tab whatever else is cached (spec audit F2).
  const refusal = [record.error, list.error].find(isNotReadable);
  // A 404 takes it whatever is cached too, as in the live thread: the rows are gone from Platform.
  const notFound = [record.error, list.error].some(isConversationNotFound);

  // The viewer belongs to the list it was opened from: it does not outlive the selection or the list.
  if (viewing && (viewing.openedFrom !== selectedId || refusal || notFound)) setViewing(null);

  if (refusal) return <ReadRefusal error={refusal} />;

  if (record.isLoading || list.isLoading) {
    return (
      <div data-testid="history-loading" className="space-y-2 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const emptyHistory = (
    <div className="flex items-center justify-center p-6 text-sm text-slate-500">
      {t('agent:context.no_history')}
    </div>
  );

  if (notFound) return emptyHistory;

  // Any other failure only counts when there is nothing loaded to keep showing.
  const failure = list.data ? null : (list.error ?? (contactId ? null : record.error));
  if (failure) return <ReadRefusal error={failure} />;

  const history = list.data ?? [];
  if (history.length === 0) return emptyHistory;

  return (
    <div data-testid="history-list" className="divide-y divide-slate-100 dark:divide-slate-700/50">
      {history.map((item) => (
        <HistoryRow
          key={item.id}
          item={item}
          onOpen={(id) => {
            if (selectedId) setViewing({ id, openedFrom: selectedId });
          }}
        />
      ))}
      {list.hasNextPage && (
        <div className="px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            data-testid="history-more"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            {t('agent:history.show_older')}
          </Button>
        </div>
      )}
      <Sheet
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        {/* Its own close control: the Sheet's default one carries an English literal. */}
        <SheetContent showCloseButton={false} className="data-[side=right]:sm:max-w-xl">
          <SheetClose
            data-testid="history-viewer-close"
            aria-label={t('common:actions.close')}
            render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" />}
          >
            <XIcon />
          </SheetClose>
          <ViewerLoadBoundary key={viewing?.id}>
            <Suspense
              fallback={
                <div data-testid="history-viewer-loading" className="space-y-2 p-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              }
            >
              {viewing && <PastConversationViewer conversationId={viewing.id} />}
            </Suspense>
          </ViewerLoadBoundary>
        </SheetContent>
      </Sheet>
    </div>
  );
}
