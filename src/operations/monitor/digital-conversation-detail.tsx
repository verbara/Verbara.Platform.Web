import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserCheck, X, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Textarea } from '@/core/ui/textarea';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import {
  useSupervisorMessages,
  useTakeoverConversation,
  useCloseDigitalConversation,
  useSendCoachingNote,
  type SupervisorConversation,
} from '@/core/api/hooks/use-supervisor';
import { useFormatDate } from '@/core/i18n/use-format';

interface DigitalConversationDetailProps {
  readonly conversation: SupervisorConversation;
}

export function DigitalConversationDetail({ conversation }: DigitalConversationDetailProps) {
  const { t } = useTranslation('operations');
  const { formatTimeShort } = useFormatDate();
  const { data: messages = [] } = useSupervisorMessages(conversation.id);
  const takeoverMutation = useTakeoverConversation();
  const closeMutation = useCloseDigitalConversation();
  const noteMutation = useSendCoachingNote();

  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  function handleSendNote() {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    noteMutation.mutate(
      { conversationId: conversation.id, text: trimmed },
      { onSuccess: () => setNoteText('') },
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border" data-testid="digital-conversation-detail">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{conversation.contactName}</p>
          <p className="text-xs text-muted-foreground">
            {conversation.channel} · {conversation.queueName} · {conversation.state}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTakeoverOpen(true)}
            disabled={takeoverMutation.isPending}
            data-testid="digital-takeover-btn"
          >
            <UserCheck className="h-3.5 w-3.5" data-icon="inline-start" />
            {t('monitor.takeover')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCloseOpen(true)}
            disabled={closeMutation.isPending}
            data-testid="digital-close-btn"
          >
            <X className="h-3.5 w-3.5" data-icon="inline-start" />
            {t('monitor.close')}
          </Button>
        </div>
      </div>

      {/* Messages (read-only) */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4" data-testid="digital-messages">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('monitor.no_messages_yet')}</p>
        ) : (
          messages.map((msg) => {
            const isAgent = msg.sender === 'agent';
            const isSystem = msg.sender === 'system';
            const bubbleClass = isSystem
              ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 italic text-xs'
              : isAgent
                ? 'bg-teal-100 text-teal-900 dark:bg-teal-900/30 dark:text-teal-200'
                : 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100';
            return (
              <div
                key={msg.id}
                className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${bubbleClass}`}>
                  {!isSystem && (
                    <p className="text-[10px] font-semibold opacity-70">{msg.senderName}</p>
                  )}
                  <p>{msg.text}</p>
                  <p className="mt-0.5 text-[10px] opacity-50">
                    {formatTimeShort(msg.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Coaching note input */}
      <div className="border-t p-3">
        <div className="flex items-center gap-1 text-xs text-amber-600">
          <MessageCircle className="h-3.5 w-3.5" />
          {t('monitor.coaching_note_label')}
        </div>
        <div className="mt-1 flex gap-2">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t('monitor.coaching_note_placeholder')}
            rows={2}
            className="flex-1"
            data-testid="digital-note-input"
          />
          <Button
            size="sm"
            onClick={handleSendNote}
            disabled={!noteText.trim() || noteMutation.isPending}
            data-testid="digital-send-note-btn"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={takeoverOpen}
        onOpenChange={setTakeoverOpen}
        title={t('monitor.takeover_dialog_title')}
        description={t('monitor.takeover_dialog_desc')}
        onConfirm={() => {
          takeoverMutation.mutate(conversation.id);
          setTakeoverOpen(false);
        }}
        confirmLabel={t('monitor.takeover')}
        variant="default"
      />

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={t('monitor.close_dialog_title')}
        description={t('monitor.close_dialog_desc')}
        onConfirm={() => {
          closeMutation.mutate({ conversationId: conversation.id });
          setCloseOpen(false);
        }}
        confirmLabel={t('monitor.close')}
        variant="destructive"
      />
    </div>
  );
}
