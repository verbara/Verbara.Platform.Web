import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAgentAiStore, EMPTY_SESSION } from '@/core/stores/agent-ai-store';

const PRIORITY_STYLES: Record<string, string> = {
  Informational: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500',
  Important: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500',
  Urgent: 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-500',
  Critical: 'border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  Informational: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Important: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Urgent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const AUTO_DISMISS_MS = 15_000;

export function SuggestionBanner({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation('agent');
  const suggestions = useAgentAiStore(
    (s) => (s.sessions[conversationId] ?? EMPTY_SESSION).suggestions,
  );
  const dismissSuggestion = useAgentAiStore((s) => s.dismissSuggestion);

  // Track timers by suggestion id
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const visible = suggestions.slice(0, 3);
    const visibleIds = new Set(visible.map((s) => s.id));

    // Clear timers for dismissed suggestions
    for (const [id, timer] of timersRef.current.entries()) {
      if (!visibleIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }

    // Set timers for new suggestions
    for (const suggestion of visible) {
      if (!timersRef.current.has(suggestion.id)) {
        const timer = setTimeout(() => {
          dismissSuggestion(conversationId, suggestion.id);
          timersRef.current.delete(suggestion.id);
        }, AUTO_DISMISS_MS);
        timersRef.current.set(suggestion.id, timer);
      }
    }

    return () => {
      // Cleanup on unmount
    };
  }, [suggestions, dismissSuggestion, conversationId]);

  const visible = suggestions.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 px-4 pt-2">
      {visible.map((suggestion) => {
        const borderStyle =
          PRIORITY_STYLES[suggestion.priority] ?? PRIORITY_STYLES['Informational'];
        const badgeStyle = PRIORITY_BADGE[suggestion.priority] ?? PRIORITY_BADGE['Informational'];

        return (
          <div
            key={suggestion.id}
            className={`flex items-start gap-2 rounded-md border-l-4 p-2.5 text-sm shadow-sm ${borderStyle}`}
          >
            <div className="flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeStyle}`}
                >
                  {t('ai.suggestion')} · {suggestion.priority}
                </span>
                {suggestion.source && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {suggestion.source}
                  </span>
                )}
              </div>
              <p className="text-slate-800 dark:text-slate-100">{suggestion.text}</p>
            </div>
            <button
              onClick={() => dismissSuggestion(conversationId, suggestion.id)}
              className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label={t('ai.dismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
