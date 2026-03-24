import { useState } from 'react';
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
  ArrowRightLeft,
  ClipboardCheck,
  X,
  Check,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { useConversationStore } from '@/agent/stores/conversation-store';
import {
  useAcceptConversation,
  useRejectConversation,
  useCloseConversation,
} from '@/core/api/hooks/use-conversations';
import { MessageThread } from './message-thread';
import { ReplyComposer } from './reply-composer';
import { TransferDialog } from './transfer-dialog';
import { WrapUpDialog } from './wrap-up-dialog';

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

const channelColors: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  sms: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  webchat: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  voice: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  messenger: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  telegram: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export function ConversationPanel({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation('agent');
  const conversation = useConversationStore((s) => s.conversations[conversationId]);

  const acceptMutation = useAcceptConversation();
  const rejectMutation = useRejectConversation();
  const closeMutation = useCloseConversation();

  const [transferOpen, setTransferOpen] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Conversation not found
      </div>
    );
  }

  const ChannelIcon = channelIcons[conversation.channel] ?? Globe;
  const badgeColor =
    channelColors[conversation.channel] ??
    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

  function handleAccept() {
    acceptMutation.mutate(conversation!.id);
  }

  function handleReject() {
    rejectMutation.mutate(conversation!.id);
    setRejectOpen(false);
  }

  function handleClose() {
    closeMutation.mutate(conversation!.id);
    setCloseOpen(false);
  }

  const isOffered = conversation.state === 'offered';
  const isActive =
    conversation.state === 'active' ||
    conversation.state === 'on_hold' ||
    conversation.state === 'consulting';
  const isWrapUp = conversation.state === 'wrap_up';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {conversation.contactName}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeColor}`}
          >
            <ChannelIcon className="h-3 w-3" />
            {conversation.channel}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {conversation.queueName}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {isOffered && (
            <>
              <Button size="sm" onClick={handleAccept}>
                <Check className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.accept')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.reject')}
              </Button>
            </>
          )}

          {isActive && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTransferOpen(true)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.transfer')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWrapUpOpen(true)}
              >
                <ClipboardCheck className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.wrap_up')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCloseOpen(true)}
              >
                <X className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.close')}
              </Button>
            </>
          )}

          {isWrapUp && (
            <Button size="sm" onClick={() => setWrapUpOpen(true)}>
              <ClipboardCheck className="h-3.5 w-3.5" data-icon="inline-start" />
              {t('conversation.complete_wrap_up')}
            </Button>
          )}
        </div>
      </div>

      {/* Message Thread */}
      <MessageThread conversationId={conversationId} />

      {/* Reply Composer */}
      <ReplyComposer conversationId={conversationId} contactName={conversation.contactName} />

      {/* Dialogs */}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t('conversation.reject_title')}
        description={t('conversation.reject_description')}
        onConfirm={handleReject}
        confirmLabel={t('conversation.reject')}
        variant="destructive"
      />

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={t('conversation.close_title')}
        description={t('conversation.close_description')}
        onConfirm={handleClose}
        confirmLabel={t('conversation.close')}
        variant="default"
      />

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        conversationId={conversationId}
      />

      <WrapUpDialog
        open={wrapUpOpen}
        onOpenChange={setWrapUpOpen}
        conversationId={conversationId}
      />
    </div>
  );
}
