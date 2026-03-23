import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'lg';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function ringColor(score: number): string {
  if (score >= 80) return 'border-green-500';
  if (score >= 60) return 'border-amber-400';
  return 'border-red-500';
}

function trackColor(score: number): string {
  if (score >= 80) return 'border-green-100 dark:border-green-900';
  if (score >= 60) return 'border-amber-100 dark:border-amber-900';
  return 'border-red-100 dark:border-red-900';
}

export function ScoreGauge({ score, size = 'lg' }: ScoreGaugeProps) {
  const isLg = size === 'lg';

  // Use conic gradient for the ring effect
  const percentage = Math.min(Math.max(score, 0), 100);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full',
        isLg ? 'h-28 w-28' : 'h-14 w-14',
      )}
      style={{
        background: `conic-gradient(${
          score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
        } ${percentage * 3.6}deg, ${
          score >= 80 ? '#dcfce7' : score >= 60 ? '#fef3c7' : '#fee2e2'
        } ${percentage * 3.6}deg)`,
      }}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-background',
          isLg ? 'h-22 w-22' : 'h-10 w-10',
        )}
      >
        <span
          className={cn(
            'font-bold tabular-nums',
            scoreColor(score),
            isLg ? 'text-2xl' : 'text-sm',
          )}
        >
          {score}%
        </span>
      </div>
    </div>
  );
}

export function ScoreInline({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold tabular-nums',
        scoreColor(score),
      )}
    >
      <span
        className={cn(
          'inline-block h-2.5 w-2.5 rounded-full border-2',
          ringColor(score),
          trackColor(score),
        )}
      />
      {score}%
    </span>
  );
}
