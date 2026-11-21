import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAgentAiStore, EMPTY_SESSION, SUPERVISOR_SOURCE } from '@/core/stores/agent-ai-store';

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
const VISIBLE_SLOTS = 3;

/**
 * The agent's suggestion banner (design D4/D5 of change `supervisor-whisper-reaches-the-agent`).
 * A supervisor's whisper (`source` `Supervisor`) is shown before every other item, has no timer and
 * stays until the agent dismisses it; more than three pending whispers add a "+N more" line. Every
 * other item keeps today's 15 s auto-dismiss, run on the first three non-`Supervisor` items in store
 * order whether or not they are visible, so whispers change no other item's timer.
 */
export function SuggestionBanner({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation('agent');
  const suggestions = useAgentAiStore(
    (s) => (s.sessions[conversationId] ?? EMPTY_SESSION).suggestions,
  );
  const dismissSuggestion = useAgentAiStore((s) => s.dismissSuggestion);

  const { supervisor, others } = useMemo(
    () => ({
      supervisor: suggestions.filter((s) => s.source === SUPERVISOR_SOURCE),
      others: suggestions.filter((s) => s.source !== SUPERVISOR_SOURCE),
    }),
    [suggestions],
  );

  // Track timers by suggestion id
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timed = others.slice(0, VISIBLE_SLOTS);
    const timedIds = new Set(timed.map((s) => s.id));

    // Clear timers for items that left the first three (dismissed, or pushed out by newer ones)
    for (const [id, timer] of timersRef.current.entries()) {
      if (!timedIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }

    // Set timers for new items among the first three
    for (const suggestion of timed) {
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
  }, [others, dismissSuggestion, conversationId]);

  const visible = [...supervisor, ...others].slice(0, VISIBLE_SLOTS);
  const hiddenSupervisorCount = Math.max(0, supervisor.length - VISIBLE_SLOTS);

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
            data-testid="suggestion-item"
            data-suggestion-id={suggestion.id}
            data-suggestion-source={suggestion.source}
            data-suggestion-priority={suggestion.priority}
          >
            <div className="flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeStyle}`}
                >
                  {t('ai.suggestion')} · {suggestion.priority}
                </span>
                {suggestion.source && (
                  <span
                    className="text-[10px] text-slate-500 dark:text-slate-500"
                    data-testid="suggestion-source-label"
                  >
                    {suggestion.source === SUPERVISOR_SOURCE
                      ? t('ai.source_supervisor')
                      : suggestion.source}
                  </span>
                )}
              </div>
              <p className="text-slate-800 dark:text-slate-100" data-testid="suggestion-text">
                {suggestion.text}
              </p>
            </div>
            <button
              onClick={() => dismissSuggestion(conversationId, suggestion.id)}
              className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label={t('ai.dismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      {hiddenSupervisorCount > 0 && (
        <p
          className="px-1 text-xs font-medium text-red-700 dark:text-red-300"
          data-testid="suggestion-hidden-count"
          data-hidden-supervisor-count={hiddenSupervisorCount}
        >
          {t('ai.more_from_supervisor', { count: hiddenSupervisorCount })}
        </p>
      )}
    </div>
  );
}
