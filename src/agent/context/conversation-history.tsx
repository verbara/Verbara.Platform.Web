import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS, ptBR } from 'date-fns/locale';
import { Clock, MessageSquare } from 'lucide-react';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useContactConversations } from '@/core/api/hooks/use-contacts';

const dateLocales: Record<string, typeof enUS> = {
  'es-419': es,
  'en-US': enUS,
  'pt-BR': ptBR,
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  webchat: 'Web Chat',
  voice: 'Voice',
  sms: 'SMS',
  telegram: 'Telegram',
};

export function ConversationHistory() {
  const { t, i18n } = useTranslation(['agent']);
  const selectedId = useConversationStore((s) => s.selectedId);
  const conversations = useConversationStore((s) => s.conversations);

  const conversation = selectedId ? conversations[selectedId] : null;
  const contactId = conversation?.contactId;
  const { data: history = [] } = useContactConversations(contactId);

  const locale = dateLocales[i18n.language] ?? es;

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-slate-500">
        {t('agent:context.no_history')}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
      {history.map((item) => (
        <div key={item.id} className="space-y-1 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {channelLabels[item.channel] ?? item.channel}
            </span>
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(item.closedAt ?? item.createdAt), {
                addSuffix: true,
                locale,
              })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {item.queueName}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(item.durationSeconds ?? 0)}
            </span>
          </div>
          {item.disposition && (
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {t(`agent:wrap_up.dispositions.${item.disposition}`, item.disposition)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
