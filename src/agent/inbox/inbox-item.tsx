import { useNavigate } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS, ptBR } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Mail,
  Smartphone,
  Globe,
  Phone,
  MessagesSquare,
  Camera,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import { cn } from '@/lib/utils';

const LOCALE_MAP: Record<string, Locale> = {
  'es-419': es,
  'en-US': enUS,
  'pt-BR': ptBR,
};

const channelIcons: Record<string, LucideIcon> = {
  whatsapp: MessageSquare,
  email: Mail,
  sms: Smartphone,
  webchat: Globe,
  voice: Phone,
  messenger: MessagesSquare,
  instagram: Camera,
  telegram: Send,
};

const stateColors: Record<Conversation['state'], string> = {
  offered: 'bg-amber-400',
  active: 'bg-emerald-400',
  on_hold: 'bg-orange-400',
  consulting: 'bg-purple-400',
  queued: 'bg-slate-400',
  waiting_for_customer: 'bg-sky-400',
  snoozed: 'bg-slate-300',
  wrap_up: 'bg-rose-400',
};

export function InboxItem({ conversation }: { readonly conversation: Conversation }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const select = useConversationStore((s) => s.select);
  const markRead = useConversationStore((s) => s.markRead);
  const selectedId = useConversationStore((s) => s.selectedId);
  const isSelected = selectedId === conversation.id;

  const ChannelIcon = channelIcons[conversation.channel] ?? Globe;

  function handleClick() {
    select(conversation.id);
    markRead(conversation.id);
    navigate(`/agent/conversation/${conversation.id}`);
  }

  const locale = LOCALE_MAP[i18n.resolvedLanguage ?? i18n.language] ?? es;
  const relativeTime = formatDistanceToNow(new Date(conversation.lastMessageAt), {
    addSuffix: false,
    locale,
  });

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50',
      )}
    >
      {/* Channel icon */}
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
        <ChannelIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              conversation.unread
                ? 'font-semibold text-slate-900 dark:text-white'
                : 'font-medium text-slate-700 dark:text-slate-200',
            )}
          >
            {conversation.contactName}
          </span>
          <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-500">
            {relativeTime}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={cn(
              'min-w-0 flex-1 truncate text-xs',
              conversation.unread
                ? 'font-medium text-slate-700 dark:text-slate-300'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {conversation.lastMessage}
          </p>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* State indicator */}
            <span className={cn('h-2 w-2 rounded-full', stateColors[conversation.state])} />

            {/* Unread indicator */}
            {conversation.unread && <span className="h-2 w-2 rounded-full bg-blue-500" />}
          </div>
        </div>
      </div>
    </button>
  );
}
