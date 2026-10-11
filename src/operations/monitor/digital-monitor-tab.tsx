import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Mail,
  Smartphone,
  Globe,
  Send,
  MessagesSquare,
  Camera,
  type LucideIcon,
} from 'lucide-react';
import {
  useSupervisorConversations,
  type SupervisorConversation,
} from '@/core/api/hooks/use-supervisor';
import { DigitalConversationDetail } from './digital-conversation-detail';

const channelIcons: Record<string, LucideIcon> = {
  WhatsApp: MessageSquare,
  Email: Mail,
  Sms: Smartphone,
  WebChat: Globe,
  Messenger: MessagesSquare,
  Instagram: Camera,
  Telegram: Send,
};

const stateColors: Record<string, string> = {
  active: 'bg-green-500',
  on_hold: 'bg-orange-500',
  queued: 'bg-slate-400',
  offered: 'bg-amber-500',
  wrap_up: 'bg-rose-500',
  waiting_for_customer: 'bg-sky-500',
};

interface ConversationCardProps {
  readonly conversation: SupervisorConversation;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}

function ConversationCard({ conversation, isSelected, onClick }: ConversationCardProps) {
  const Icon = channelIcons[conversation.channel] ?? Globe;
  const stateColor = stateColors[conversation.state] ?? 'bg-slate-400';

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`digital-conv-card-${conversation.id}`}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        isSelected
          ? 'border-brand bg-brand/5'
          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">{conversation.contactName}</span>
        <span className={`h-2 w-2 shrink-0 rounded-full ${stateColor}`} />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {conversation.queueName} · {conversation.state}
      </p>
      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{conversation.lastMessage}</p>
    </button>
  );
}

/**
 * `initialSelectedId` opens that conversation's detail once the list carries it: the monitor's
 * `?conversation=` link (the new-conversation dialog's `conversation-open-elsewhere` refusal). Viewing
 * only; a takeover still needs the detail's own confirmed action.
 */
export function DigitalMonitorTab({
  initialSelectedId,
}: Readonly<{ initialSelectedId?: string | null }> = {}) {
  const { t } = useTranslation('operations');
  const { data, isSuccess } = useSupervisorConversations();
  const conversations = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  // The list is the first page only (and Platform has no single-conversation read for supervisors):
  // a linked conversation that closed or sits further down is said to be missing, not left blank.
  const linkMissing =
    isSuccess && selectedId !== null && selectedId === initialSelectedId && selected === null;

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      {/* Left panel — conversation list */}
      <div
        className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto"
        data-testid="digital-conversations-list"
      >
        {conversations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('monitor.no_digital_sessions')}
          </p>
        ) : (
          conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onClick={() => setSelectedId(conv.id)}
            />
          ))
        )}
      </div>

      {/* Right panel — detail */}
      <div className="min-w-0 flex-1 overflow-hidden" data-testid="digital-detail-panel">
        {selected ? (
          <DigitalConversationDetail conversation={selected} />
        ) : linkMissing ? (
          <div
            role="status"
            data-testid="digital-linked-conversation-missing"
            className="flex h-full items-center justify-center rounded-lg border border-dashed border-border p-4"
          >
            <p className="text-center text-sm text-muted-foreground">
              {t('monitor.linked_conversation_missing')}
            </p>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {conversations.length === 0
                ? t('monitor.no_digital_sessions')
                : t('monitor.select_to_monitor')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
