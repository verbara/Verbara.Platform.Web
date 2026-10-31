import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/core/ui/tooltip';
import { useDraftStore } from '@/agent/stores/draft-store';
import { useConversationStore, type Message } from '@/agent/stores/conversation-store';
import { useSendMessage } from '@/core/api/hooks/use-conversations';
import { CannedResponses } from './canned-responses';

interface ReplyComposerProps {
  conversationId: string;
  contactName: string;
}

export function ReplyComposer({ conversationId, contactName }: ReplyComposerProps) {
  const { t } = useTranslation('agent');
  const setDraft = useDraftStore((s) => s.setDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const [text, setText] = useState(() => useDraftStore.getState().drafts[conversationId] ?? '');
  const [cannedOpen, setCannedOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addMessage = useConversationStore((s) => s.addMessage);
  const sendMessageMutation = useSendMessage();

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [text]);

  // Debounced draft save
  const saveDraft = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value.trim()) {
          setDraft(conversationId, value);
        } else {
          clearDraft(conversationId);
        }
      }, 500);
    },
    [conversationId, setDraft, clearDraft],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);
      saveDraft(value);

      // Check for "/" trigger at start of input or after a newline
      const lines = value.split('\n');
      const currentLine = lines[lines.length - 1] ?? '';
      if (currentLine === '/') {
        setCannedOpen(true);
      } else if (!currentLine.startsWith('/')) {
        setCannedOpen(false);
      }
    },
    [saveDraft],
  );

  const handleCannedSelect = useCallback(
    (responseText: string) => {
      // Replace the "/" trigger with the canned response text
      const lines = text.split('\n');
      const lastLine = lines[lines.length - 1] ?? '';
      const prefix = lastLine.startsWith('/')
        ? lines.slice(0, -1).join('\n') + (lines.length > 1 ? '\n' : '')
        : text;
      const newText = prefix + responseText;
      setText(newText);
      saveDraft(newText);
      setCannedOpen(false);
      textareaRef.current?.focus();
    },
    [text, saveDraft],
  );

  const handleCannedClose = useCallback(() => {
    setCannedOpen(false);
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      sender: 'agent',
      senderName: t('composer.you'),
      text: trimmed,
      timestamp: new Date().toISOString(),
      type: 'text',
      status: 'sending',
    };

    // Optimistically add to store
    addMessage(conversationId, message);
    setText('');
    clearDraft(conversationId);
    textareaRef.current?.focus();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Send to API
    sendMessageMutation.mutate({ conversationId, text: trimmed });
  }, [t, text, conversationId, addMessage, clearDraft, sendMessageMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape' && cannedOpen) {
        e.preventDefault();
        setCannedOpen(false);
      }
    },
    [handleSend, cannedOpen],
  );

  const canSend = text.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
      {/* Composer area */}
      <div className="relative flex items-end gap-2">
        {/* Canned responses dropdown */}
        <CannedResponses
          open={cannedOpen}
          onSelect={handleCannedSelect}
          onClose={handleCannedClose}
          contactName={contactName}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('conversation.reply_placeholder')}
          rows={1}
          data-testid="reply-composer-input"
          className="max-h-40 min-h-[40px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
        />

        {/* Send button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  data-testid="reply-composer-send"
                  className="mb-1.5 shrink-0 rounded-lg bg-teal-600 p-2 text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-500 dark:hover:bg-teal-600"
                  aria-label={t('composer.send')}
                />
              }
            >
              <Send className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="top">
              {t('composer.send')}
              <kbd className="ml-1.5 rounded bg-white/20 px-1 py-0.5 text-[10px]">
                {t('composer.send_shortcut')}
              </kbd>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
