import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS, ptBR } from 'date-fns/locale';
import { Clock, MessageSquare } from 'lucide-react';
import { useConversationStore } from '@/agent/stores/conversation-store';

interface PastConversation {
  id: string;
  date: string;
  channel: string;
  queueName: string;
  disposition: string;
  durationSeconds: number;
}

const MOCK_HISTORY: Record<string, PastConversation[]> = {
  'c-101': [
    {
      id: 'h-1',
      date: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      channel: 'whatsapp',
      queueName: 'support',
      disposition: 'resolved',
      durationSeconds: 420,
    },
    {
      id: 'h-2',
      date: new Date(Date.now() - 14 * 86_400_000).toISOString(),
      channel: 'email',
      queueName: 'billing',
      disposition: 'escalated',
      durationSeconds: 1800,
    },
  ],
  'c-102': [
    {
      id: 'h-3',
      date: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      channel: 'email',
      queueName: 'billing',
      disposition: 'resolved',
      durationSeconds: 900,
    },
  ],
  'c-103': [
    {
      id: 'h-4',
      date: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      channel: 'webchat',
      queueName: 'sales',
      disposition: 'follow_up',
      durationSeconds: 600,
    },
    {
      id: 'h-5',
      date: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      channel: 'webchat',
      queueName: 'sales',
      disposition: 'resolved',
      durationSeconds: 300,
    },
    {
      id: 'h-6',
      date: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      channel: 'email',
      queueName: 'support',
      disposition: 'no_response',
      durationSeconds: 0,
    },
  ],
};

const dateLocales: Record<string, Locale> = {
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
  const history = contactId ? MOCK_HISTORY[contactId] ?? [] : [];

  const locale = dateLocales[i18n.language] ?? es;

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-slate-400">
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
            <span className="text-xs text-slate-400">
              {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {item.queueName}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(item.durationSeconds)}
            </span>
          </div>
          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {t(`agent:wrap_up.dispositions.${item.disposition}`, item.disposition)}
          </span>
        </div>
      ))}
    </div>
  );
}
