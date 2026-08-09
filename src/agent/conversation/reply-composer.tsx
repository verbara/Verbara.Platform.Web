import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, Send, X, FileIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/core/ui/tooltip';
import { useDraftStore } from '@/agent/stores/draft-store';
import { useConversationStore, type Message } from '@/agent/stores/conversation-store';
import { useSendMessage } from '@/core/api/hooks/use-conversations';
import { useUploadMedia } from '@/core/api/hooks/use-media';
import { CannedResponses } from './canned-responses';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

interface FileAttachment {
  file: File;
  preview: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ReplyComposerProps {
  conversationId: string;
  contactName: string;
}

export function ReplyComposer({ conversationId, contactName }: ReplyComposerProps) {
  const { t } = useTranslation('agent');
  const setDraft = useDraftStore((s) => s.setDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const [text, setText] = useState(() => useDraftStore.getState().drafts[conversationId] ?? '');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [cannedOpen, setCannedOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addMessage = useConversationStore((s) => s.addMessage);
  const sendMessageMutation = useSendMessage();
  const uploadMedia = useUploadMedia();

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

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    let mediaId: string | undefined;

    if (attachments.length > 0 && attachments[0]) {
      try {
        const result = await uploadMedia.mutateAsync(attachments[0].file);
        mediaId = result.id;
      } catch {
        // toast already shown by onError in useUploadMedia
        return;
      }
    }

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      sender: 'agent',
      senderName: 'You',
      text: trimmed,
      timestamp: new Date().toISOString(),
      type:
        attachments.length > 0 && attachments[0]!.file.type.startsWith('image/')
          ? 'image'
          : trimmed
            ? 'text'
            : 'file',
      status: 'sending',
      metadata:
        attachments.length > 0
          ? {
              fileName: attachments[0]!.file.name,
              fileSize: formatFileSize(attachments[0]!.file.size),
              mediaId,
            }
          : undefined,
    };

    // Optimistically add to store
    addMessage(conversationId, message);
    setText('');
    clearDraft(conversationId);
    setAttachments([]);
    textareaRef.current?.focus();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Send to API
    sendMessageMutation.mutate({ conversationId, text: trimmed });
  }, [text, attachments, conversationId, addMessage, clearDraft, sendMessageMutation, uploadMedia]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        // Skip files over 25MB — in production this would show a toast
        continue;
      }
      const isImage = file.type.startsWith('image/');
      const preview = isImage ? URL.createObjectURL(file) : null;
      newAttachments.push({ file, preview });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);

    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !uploadMedia.isPending;

  return (
    <div className="shrink-0 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
      {/* File previews */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div
              key={`${att.file.name}-${idx}`}
              className="group relative flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-600 dark:bg-slate-700/50"
            >
              {att.preview ? (
                <img
                  src={att.preview}
                  alt={att.file.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <FileIcon className="h-5 w-5 shrink-0 text-slate-500" />
              )}
              <div className="flex flex-col">
                <span className="max-w-32 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {att.file.name}
                </span>
                <span className="text-[10px] text-slate-500">{formatFileSize(att.file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="ml-1 rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                aria-label={t('composer.remove_attachment', { name: att.file.name })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer area */}
      <div className="relative flex items-end gap-2">
        {/* Canned responses dropdown */}
        <CannedResponses
          open={cannedOpen}
          onSelect={handleCannedSelect}
          onClose={handleCannedClose}
          contactName={contactName}
        />

        {/* Attach file button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-1.5 shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  aria-label={t('composer.attach_file')}
                />
              }
            >
              <Paperclip className="h-4.5 w-4.5" />
            </TooltipTrigger>
            <TooltipContent side="top">{t('composer.attach_file')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('conversation.reply_placeholder')}
          rows={1}
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
