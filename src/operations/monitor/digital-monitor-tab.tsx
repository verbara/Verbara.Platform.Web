import { useState } from 'react';
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
  conversation: SupervisorConversation;
  isSelected: boolean;
  onClick: () => void;
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
      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{conversation.lastMessage}</p>
    </button>
  );
}

export function DigitalMonitorTab() {
  const { data } = useSupervisorConversations();
  const conversations = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto" data-testid="digital-conversations-list">
        {conversations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No digital conversations
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
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {conversations.length === 0
                ? 'No digital conversations'
                : 'Select a conversation to monitor.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
