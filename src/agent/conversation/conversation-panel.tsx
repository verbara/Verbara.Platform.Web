import { useEffect, useState } from 'react';
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
  CircleX,
  Pause,
  Play,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import {
  useAcceptConversation,
  useRejectConversation,
  useCloseConversation,
  useHoldConversation,
  useUnholdConversation,
} from '@/core/api/hooks/use-conversations';
import { MessageThread } from './message-thread';
import { ReplyComposer } from './reply-composer';
import { TransferDialog } from './transfer-dialog';
import { WrapUpDialog } from './wrap-up-dialog';
import { SuggestionBanner } from './suggestion-banner';
import { SentimentGauge } from './sentiment-gauge';
import { ComplianceAlert } from './compliance-alert';

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
  const holdMutation = useHoldConversation();
  const unholdMutation = useUnholdConversation();

  const [transferOpen, setTransferOpen] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  // Voice (3B.1): the call is controlled by the floating call card / softphone, not the messaging
  // action buttons; the panel surfaces contact context + disposition. Hooks run before the early
  // return (rules of hooks). `conversation` is already resolved above so the channel read is safe.
  const isVoice = conversation?.channel === 'voice';
  const voicePhase = useVoiceCallStore((s) => s.phase);
  const voiceConversationId = useVoiceCallStore((s) => s.associatedConversationId);
  const wrapUpPromptedFor = useVoiceCallStore((s) => s.wrapUpPromptedFor);

  // Auto-open the wrap-up dialog ONCE when THIS voice call ends (the bridge already moved the
  // Conversation to WrapUp server-side; the channel-agnostic WrapUpDialog disposes it). A store-level
  // one-shot (wrapUpPromptedFor) so it does not re-open on revisit/remount after the agent dismisses
  // it (finding #3), yet still opens once when the agent returns to a just-ended call (finding #14).
  useEffect(() => {
    if (
      isVoice &&
      voicePhase === 'ended' &&
      voiceConversationId === conversationId &&
      wrapUpPromptedFor !== conversationId
    ) {
      setWrapUpOpen(true);
      useVoiceCallStore.getState().markWrapUpPrompted(conversationId);
    }
  }, [isVoice, voicePhase, voiceConversationId, wrapUpPromptedFor, conversationId]);

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
          <SentimentGauge />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Voice: the call is controlled by the floating call card (mute/hold/transfer = 3B.2).
              The panel only offers disposition; messaging actions are suppressed. */}
          {isVoice && (isActive || isWrapUp) && (
            <Button size="sm" onClick={() => setWrapUpOpen(true)} data-testid="voice-wrapup-btn">
              <ClipboardCheck className="h-3.5 w-3.5" data-icon="inline-start" />
              {isWrapUp ? t('conversation.complete_wrap_up') : t('conversation.wrap_up')}
            </Button>
          )}

          {!isVoice && isOffered && (
            <>
              <Button size="sm" onClick={handleAccept}>
                <Check className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.accept')}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
                <CircleX className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.reject')}
              </Button>
            </>
          )}

          {!isVoice && isActive && (
            <>
              {conversation.state === 'on_hold' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unholdMutation.mutate(conversation.id)}
                  disabled={unholdMutation.isPending}
                  data-testid="conversation-resume-btn"
                >
                  <Play className="h-3.5 w-3.5" data-icon="inline-start" />
                  {t('conversation.resume')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => holdMutation.mutate(conversation.id)}
                  disabled={holdMutation.isPending || conversation.state !== 'active'}
                  data-testid="conversation-hold-btn"
                >
                  <Pause className="h-3.5 w-3.5" data-icon="inline-start" />
                  {t('conversation.hold')}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.transfer')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWrapUpOpen(true)}>
                <ClipboardCheck className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.wrap_up')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCloseOpen(true)}>
                <X className="h-3.5 w-3.5" data-icon="inline-start" />
                {t('conversation.close')}
              </Button>
            </>
          )}

          {!isVoice && isWrapUp && (
            <Button size="sm" onClick={() => setWrapUpOpen(true)}>
              <ClipboardCheck className="h-3.5 w-3.5" data-icon="inline-start" />
              {t('conversation.complete_wrap_up')}
            </Button>
          )}
        </div>
      </div>

      {/* AI Banners */}
      <SuggestionBanner />
      <ComplianceAlert />

      {/* Body: voice calls have no message thread — they show a live-call indicator (controls live
          in the floating call card); contact + history hydrate in the right-side ContextPanel. */}
      {isVoice ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500"
          data-testid="voice-call-body"
        >
          <Phone className="h-8 w-8" />
          <p className="text-sm font-medium">{t('voice.call_in_progress')}</p>
          <p className="text-xs">{t('voice.controls_in_card')}</p>
        </div>
      ) : (
        <>
          <MessageThread conversationId={conversationId} />
          <ReplyComposer
            key={conversationId}
            conversationId={conversationId}
            contactName={conversation.contactName}
          />
        </>
      )}

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
