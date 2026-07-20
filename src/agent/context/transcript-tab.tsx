import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentAiStore, EMPTY_SESSION } from '@/core/stores/agent-ai-store';

export function TranscriptTab({ conversationId }: { conversationId: string | null }) {
  const { t, i18n } = useTranslation('agent');
  const transcript = useAgentAiStore((s) =>
    conversationId
      ? (s.sessions[conversationId] ?? EMPTY_SESSION).transcript
      : EMPTY_SESSION.transcript,
  );
  const timeFmt = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  if (transcript.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-sm text-slate-400 dark:text-slate-500">
        {t('ai.waiting_transcript')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {transcript.map((segment, idx) => {
        const isCaller = segment.speaker === 'Caller';
        const key = `${segment.timestamp}-${idx}`;

        return (
          <div
            key={key}
            className={`group flex flex-col gap-0.5 ${isCaller ? 'items-start' : 'items-end'}`}
          >
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {segment.speaker} · {timeFmt.format(new Date(segment.timestamp))}
            </span>
            <button
              onClick={() => handleCopy(segment.text, key)}
              className={`max-w-[85%] cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-opacity hover:opacity-80 ${
                isCaller
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100'
                  : 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100'
              } ${!segment.isFinal ? 'opacity-60 italic' : ''}`}
              title={copiedId === key ? t('ai.copy_copied') : undefined}
            >
              {segment.text}
              {copiedId === key && (
                <span className="ml-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {t('ai.copy_copied')}
                </span>
              )}
            </button>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
