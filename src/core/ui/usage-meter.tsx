// UsageMeter — a usage/limit bar, lifted from the billing quotas page's `QuotaRow` so the quota
// rows and the licence page's licensed-agents card share one primitive instead of two copies.
//
// Tones:
//   - `quota` (default): brand below 70 %, warning from 70 %, destructive from 90 % — the
//     quotas page's scale, unchanged.
//   - `advisory`: brand below 70 %, warning from 70 % and above, never destructive. Used for the
//     licence's advisory `maxAgents` band, which nothing is ever blocked on.
//
// The caller decides whether a meter applies at all (a limit of null or 0 renders none); this
// component expects a positive `limit`.

import { cn } from '@/lib/utils';

import { usageColor, usagePercent, type UsageMeterTone } from './usage-meter-scale';

export interface UsageMeterProps {
  readonly value: number;
  readonly limit: number;
  readonly tone?: UsageMeterTone;
  readonly label?: string;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

export function UsageMeter({
  value,
  limit,
  tone = 'quota',
  label,
  className,
  'data-testid': testId,
}: UsageMeterProps) {
  const pct = usagePercent(value, limit);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={value}
      data-testid={testId}
      data-tone={tone}
      className={cn('h-2 rounded-full bg-muted', className)}
    >
      <div
        className={`h-full rounded-full transition-all ${usageColor(pct, tone)}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
