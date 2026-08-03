import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Mail,
  Smartphone,
  Globe,
  Send,
  MessagesSquare,
  Camera,
  Phone,
  UserCog,
  AlertTriangle,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/core/ui/dropdown-menu';
import { useFormatDate } from '@/core/i18n/use-format';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useAgents, type Agent } from '@/core/api/hooks/use-agents';
import {
  useStuckConversations,
  useReassignConversation,
  useRetryCallback,
  useCloseDigitalConversation,
  type StuckConversation,
} from '@/core/api/hooks/use-supervisor';
import { conversationStateLabelKey } from './stuck-work-helpers';

const channelIcons: Record<string, LucideIcon> = {
  WhatsApp: MessageSquare,
  Email: Mail,
  Sms: Smartphone,
  WebChat: Globe,
  Messenger: MessagesSquare,
  Instagram: Camera,
  Telegram: Send,
  Voice: Phone,
};

interface ReassignMenuProps {
  readonly conversationId: string;
}

function ReassignMenu({ conversationId }: ReassignMenuProps) {
  const { t } = useTranslation('operations');
  const { data: queues = [] } = useQueues();
  const { data: agents = [] } = useAgents();
  const reassign = useReassignConversation();

  // Prefer agents that can actually take work — anything that isn't offline.
  const assignableAgents = agents.filter((a: Agent) => (a.state ?? '').toLowerCase() !== 'offline');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" disabled={reassign.isPending} />}
        data-testid={`reassign-trigger-${conversationId}`}
      >
        <UserCog className="mr-1.5 h-4 w-4" />
        {t('stuck_work.reassign')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('stuck_work.reassign_to_queue')}</DropdownMenuLabel>
          {queues.map((q) => (
            <DropdownMenuItem
              key={q.id}
              data-testid={`reassign-queue-${q.id}`}
              disabled={reassign.isPending}
              onClick={() => reassign.mutate({ id: conversationId, targetQueueId: q.id })}
            >
              {q.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('stuck_work.reassign_to_agent')}</DropdownMenuLabel>
          {assignableAgents.map((a) => (
            <DropdownMenuItem
              key={a.id}
              data-testid={`reassign-agent-${a.id}`}
              disabled={reassign.isPending}
              onClick={() => reassign.mutate({ id: conversationId, targetAgentId: a.id })}
            >
              {a.displayName}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface VoiceStuckActionsProps {
  readonly conversationId: string;
}

function VoiceStuckActions({ conversationId }: VoiceStuckActionsProps) {
  const { t } = useTranslation('operations');
  const qc = useQueryClient();
  const retry = useRetryCallback();
  const close = useCloseDigitalConversation();

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        data-testid={`retry-callback-${conversationId}`}
        disabled={retry.isPending}
        onClick={() => retry.mutate(conversationId)}
      >
        <RotateCcw className="mr-1.5 h-4 w-4" />
        {t('stuck_work.retry_callback')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        data-testid={`close-stuck-${conversationId}`}
        disabled={close.isPending}
        onClick={() =>
          close.mutate(
            { conversationId },
            // The shared close hook invalidates ['supervisor','conversations']; also drop the
            // stuck list so the closed voice row disappears immediately (not on the 15s poll).
            { onSuccess: () => qc.invalidateQueries({ queryKey: ['supervisor', 'stuck'] }) },
          )
        }
      >
        {t('stuck_work.close')}
      </Button>
    </div>
  );
}

interface StuckRowProps {
  readonly conversation: StuckConversation;
}

function StuckRow({ conversation }: StuckRowProps) {
  const { t } = useTranslation('operations');
  const { formatRelative } = useFormatDate();
  const isVoice = conversation.channel === 'Voice';
  const Icon = channelIcons[conversation.channel] ?? Globe;
  const stateLabel = t(conversationStateLabelKey(conversation.state), {
    defaultValue: conversation.state,
  });
  const stuckFor = conversation.ownerOfflineSince
    ? formatRelative(conversation.ownerOfflineSince)
    : '—';

  return (
    <div
      data-testid="stuck-row"
      className="flex items-center gap-3 rounded-lg border border-border p-3"
    >
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{conversation.channel}</span>
          <Badge variant="outline">{stateLabel}</Badge>
          {conversation.escalated && (
            <Badge variant="destructive" data-testid="stuck-escalated-badge">
              <AlertTriangle className="h-3 w-3" />
              {t('stuck_work.escalated')}
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {t('stuck_work.owned_by_offline', { name: conversation.ownerAgentName })}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {t('stuck_work.stuck_for', { duration: stuckFor })}
          {conversation.failoverAttempts > 0 && (
            <span className="ml-2">
              ·{' '}
              {isVoice
                ? t('stuck_work.callback_failed', { count: conversation.failoverAttempts })
                : t('stuck_work.attempts', { count: conversation.failoverAttempts })}
            </span>
          )}
        </p>
      </div>
      {isVoice ? (
        <VoiceStuckActions conversationId={conversation.conversationId} />
      ) : (
        <ReassignMenu conversationId={conversation.conversationId} />
      )}
    </div>
  );
}

export function StuckWorkTab() {
  const { t } = useTranslation('operations');
  const { data: stuck = [] } = useStuckConversations();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" data-testid="stuck-work-tab">
      {stuck.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground" data-testid="stuck-empty">
          {t('stuck_work.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {stuck.map((conv) => (
            <StuckRow key={conv.conversationId} conversation={conv} />
          ))}
        </div>
      )}
    </div>
  );
}
