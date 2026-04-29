import { format, isToday } from 'date-fns';
import { es, enUS, ptBR } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { Check, CheckCheck, FileIcon, AlertCircle } from 'lucide-react';
import type { Message } from '@/agent/stores/conversation-store';
import { cn } from '@/lib/utils';

const LOCALE_MAP: Record<string, Locale> = {
  'es-419': es,
  'en-US': enUS,
  'pt-BR': ptBR,
};

function DeliveryStatus({ status }: { readonly status: Message['status'] }) {
  if (!status) return null;

  switch (status) {
    case 'sending':
      return <span className="text-[10px] text-white/60">...</span>;
    case 'sent':
      return <Check className="h-3 w-3 text-white/60" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-white/60" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-300" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-red-300" />;
    default:
      return null;
  }
}

function formatTimestamp(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, 'p', { locale });
  return format(date, 'PP p', { locale });
}

interface MessageBubbleProps {
  readonly message: Message;
  readonly showSender: boolean;
}

export function MessageBubble({ message, showSender }: MessageBubbleProps) {
  const { t, i18n } = useTranslation('agent');
  const locale = LOCALE_MAP[i18n.resolvedLanguage ?? i18n.language] ?? es;
  const isAgent = message.sender === 'agent';
  const isEmail = message.metadata?.contentType === 'html';

  return (
    <div className={cn('flex flex-col', isAgent ? 'items-end' : 'items-start')}>
      {showSender && (
        <span
          className={cn(
            'mb-1 text-[11px] font-medium',
            isAgent
              ? 'mr-1 text-slate-500 dark:text-slate-400'
              : 'ml-1 text-slate-500 dark:text-slate-400',
          )}
        >
          {message.senderName}
        </span>
      )}

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isAgent
            ? 'rounded-br-none bg-teal-600 text-white'
            : 'rounded-bl-none bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100',
        )}
      >
        {message.type === 'image' && typeof message.metadata?.url === 'string' && (
          <img
            src={message.metadata.url as string}
            alt={message.text || t('messages.image_alt')}
            className="mb-1.5 max-h-48 rounded-lg object-cover"
          />
        )}

        {message.type === 'file' && (
          <div className="mb-1.5 flex items-center gap-2">
            <FileIcon className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm underline">
              {(message.metadata?.fileName as string) ?? t('messages.file_fallback')}
            </span>
          </div>
        )}

        {isEmail ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }}
          />
        ) : (
          message.type !== 'file' && <span>{message.text}</span>
        )}

        <div
          className={cn(
            'mt-1 flex items-center gap-1',
            isAgent ? 'justify-end' : 'justify-end',
          )}
        >
          <span
            className={cn(
              'text-[10px]',
              isAgent ? 'text-white/60' : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {formatTimestamp(message.timestamp, locale)}
          </span>
          {isAgent && <DeliveryStatus status={message.status} />}
        </div>
      </div>
    </div>
  );
}
