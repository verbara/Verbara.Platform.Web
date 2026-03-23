import { useTranslation } from 'react-i18next';
import { useConversationStore, type ConversationFilter } from '@/agent/stores/conversation-store';
import { cn } from '@/lib/utils';

const filterStates: Record<ConversationFilter, string[]> = {
  active: ['offered', 'active', 'on_hold', 'consulting'],
  waiting: ['queued', 'waiting_for_customer', 'snoozed'],
  wrapup: ['wrap_up'],
};

const filterKeys: { key: ConversationFilter; label: string }[] = [
  { key: 'active', label: 'agent:inbox.filter_active' },
  { key: 'waiting', label: 'agent:inbox.filter_waiting' },
  { key: 'wrapup', label: 'agent:inbox.filter_wrapup' },
];

export function InboxFilters() {
  const { t } = useTranslation(['agent']);
  const filter = useConversationStore((s) => s.filter);
  const setFilter = useConversationStore((s) => s.setFilter);
  const conversations = useConversationStore((s) => s.conversations);

  function countForFilter(f: ConversationFilter): number {
    const allowed = filterStates[f];
    return Object.values(conversations).filter((c) => allowed.includes(c.state)).length;
  }

  return (
    <div className="flex gap-1 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
      {filterKeys.map(({ key, label }) => {
        const count = countForFilter(key);
        const isActive = filter === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200',
            )}
          >
            {t(label)}
            {count > 0 && (
              <span
                className={cn(
                  'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
