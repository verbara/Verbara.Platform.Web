import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { LiveRegion } from '@/core/ui/live-region';
import { VirtualList } from '@/core/ui/virtual-list';
import {
  selectFilteredConversations,
  useConversationStore,
} from '@/agent/stores/conversation-store';
import { useConversations } from '@/core/api/hooks/use-conversations';
import { useAgentMe } from '@/core/api/hooks/use-agents';
import { InboxFilters } from './inbox-filters';
import { InboxItem } from './inbox-item';
import { InboxEmpty } from './inbox-empty';
import { AgentStatusSelector } from './agent-status-selector';
import { NewConversationDialog } from './new-conversation-dialog';

const INBOX_ITEM_HEIGHT_PX = 64;

export function InboxPanel() {
  const { t } = useTranslation(['agent']);
  const mergeFromRest = useConversationStore((s) => s.mergeFromRest);
  const filter = useConversationStore((s) => s.filter);
  // Subscribe to the state the list is derived from, not to `filteredConversations` (a function
  // reference that never changes): otherwise a conversation added by SSE does not re-render the list.
  const conversationsById = useConversationStore((s) => s.conversations);

  const [newConvOpen, setNewConvOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<string>('');
  const previousFirstIdRef = useRef<string | undefined>(undefined);

  const { data: agent } = useAgentMe();
  const { data: conversations = [] } = useConversations({ agentId: agent?.id });

  // A merge, not an upsert: Platform's list has no contact name, queue name, last message or unread
  // flag, and replacing the record would wipe what SSE already delivered for the same id.
  useEffect(() => {
    conversations.forEach((c) => mergeFromRest(c));
  }, [conversations, mergeFromRest]);

  const visible = useMemo(
    () => selectFilteredConversations(conversationsById, filter),
    [conversationsById, filter],
  );

  useEffect(() => {
    const currentFirst = visible[0];
    const previousFirstId = previousFirstIdRef.current;
    if (currentFirst && previousFirstId !== undefined && currentFirst.id !== previousFirstId) {
      setAnnouncement(
        t('agent:inbox.announceNew', {
          name: currentFirst.contactName || t('agent:inbox.unknownContact'),
        }),
      );
    }
    previousFirstIdRef.current = currentFirst?.id;
  }, [visible, t]);

  return (
    <>
      <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('agent:inbox.title')}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setNewConvOpen(true)}
            data-testid="new-conversation-btn"
            aria-label={t('agent:inbox.aria.newConversation')}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <AgentStatusSelector />
        </div>
      </div>

      <InboxFilters />

      <div className="flex-1">
        {visible.length === 0 ? (
          <InboxEmpty filter={filter} />
        ) : (
          <VirtualList
            items={visible}
            getItemKey={(conv) => conv.id}
            estimateSize={() => INBOX_ITEM_HEIGHT_PX}
            renderItem={(conv) => (
              <div className="border-b border-slate-100 dark:border-slate-700/50">
                <InboxItem conversation={conv} />
              </div>
            )}
          />
        )}
      </div>

      <NewConversationDialog open={newConvOpen} onOpenChange={setNewConvOpen} />
      <LiveRegion politeness="polite">{announcement}</LiveRegion>
    </>
  );
}
