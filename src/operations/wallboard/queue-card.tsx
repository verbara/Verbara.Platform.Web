import { useTranslation } from 'react-i18next';
import type { QueueMetrics } from '@/operations/stores/queue-metrics-store';
import { useLiveState } from '@/core/api/hooks/use-analytics';

function slaColor(sla: number): string {
  if (sla >= 80) return 'border-emerald-400 dark:border-emerald-600';
  if (sla >= 60) return 'border-amber-400 dark:border-amber-600';
  return 'border-red-400 dark:border-red-600';
}

function slaBarColor(sla: number): string {
  if (sla >= 80) return 'bg-emerald-500';
  if (sla >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

interface QueueCardProps {
  queue: QueueMetrics;
}

export function QueueCard({ queue }: QueueCardProps) {
  const { t } = useTranslation('operations');
  const { data: liveState } = useLiveState(queue.queueName);

  const waiting = liveState?.callsWaiting ?? queue.waiting;
  const longestWaitSec = liveState ? Math.round(liveState.longestWaitMs / 1000) : queue.avgWaitSeconds;
  const agentsAvailable = liveState?.agentsAvailable ?? queue.agentsAvailable;
  const agentsBusy = liveState?.agentsOnCall ?? queue.agentsBusy;
  const agentsAway = liveState?.agentsPaused ?? queue.agentsAway;

  return (
    <div
      className={`rounded-xl border-l-4 bg-white p-4 shadow-sm dark:bg-slate-800 ${slaColor(queue.slaPercent)}`}
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{queue.queueName}</h3>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{waiting}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('wallboard.waiting')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {formatWait(longestWaitSec)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {liveState ? t('wallboard.longest_wait') : t('wallboard.avg_wait')}
          </p>
        </div>
      </div>

      {/* SLA progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">{t('wallboard.sla')}</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {queue.slaPercent}%
          </span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className={`h-2 rounded-full transition-all ${slaBarColor(queue.slaPercent)}`}
            style={{ width: `${Math.min(queue.slaPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Agent badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          {agentsAvailable} {t('wallboard.available')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {agentsBusy} {t('wallboard.busy')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {agentsAway} {t('wallboard.away')}
        </span>
        {liveState && liveState.agentsInWrapUp > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            {liveState.agentsInWrapUp} {t('wallboard.wrap_up')}
          </span>
        )}
      </div>
    </div>
  );
}
