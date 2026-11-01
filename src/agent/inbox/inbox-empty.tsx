import { CircleCheckBig } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ConversationFilter } from '@/agent/stores/conversation-store';

const emptyMessageKeys: Record<ConversationFilter, string> = {
  active: 'agent:inbox.empty_active',
  waiting: 'agent:inbox.empty_waiting',
  wrapup: 'agent:inbox.empty_wrapup',
};

export function InboxEmpty({ filter }: { filter: ConversationFilter }) {
  const { t } = useTranslation(['agent']);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <CircleCheckBig className="mb-3 h-10 w-10 text-emerald-400" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {t('agent:inbox.empty')}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
        {t(emptyMessageKeys[filter])}
      </p>
    </div>
  );
}
