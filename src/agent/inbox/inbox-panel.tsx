import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useConversations } from '@/core/api/hooks/use-conversations';
import { useAgentMe } from '@/core/api/hooks/use-agents';
import { InboxFilters } from './inbox-filters';
import { InboxItem } from './inbox-item';
import { InboxEmpty } from './inbox-empty';
import { AgentStatusSelector } from './agent-status-selector';
import { NewConversationDialog } from './new-conversation-dialog';

export function InboxPanel() {
  const { t } = useTranslation(['agent']);
  const upsertConversation = useConversationStore((s) => s.upsertConversation);
  const filter = useConversationStore((s) => s.filter);
  const filteredConversations = useConversationStore((s) => s.filteredConversations);

  const [newConvOpen, setNewConvOpen] = useState(false);

  const { data: agent } = useAgentMe();
  const { data: conversations = [] } = useConversations({ agentId: agent?.id });

  useEffect(() => {
    conversations.forEach((c) => upsertConversation(c));
  }, [conversations, upsertConversation]);

  const visible = filteredConversations();

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

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <InboxEmpty filter={filter} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {visible.map((conv) => (
              <InboxItem key={conv.id} conversation={conv} />
            ))}
          </div>
        )}
      </div>

      <NewConversationDialog open={newConvOpen} onOpenChange={setNewConvOpen} />
    </>
  );
}
