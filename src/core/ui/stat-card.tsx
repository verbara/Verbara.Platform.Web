// StatCard — KPI/stat surface for dashboards, license cards, and any single-
// metric summary card currently rendered via ad-hoc `rounded-lg border bg-card
// p-4` divs in dashboard-page, survey-results-page, cluster-page, etc.
//
// Layout (top-to-bottom):
//   top:    [icon]  label                               [statusBadge]
//   main:   value (large, prominent)
//   bottom: [description]                       [trend-arrow trend-value]
//
// When `onClick` is provided, the card becomes keyboard-interactive:
//   role="button", tabIndex=0, Enter + Space trigger the handler, Space
//   preventDefault to avoid page scroll.

import type { KeyboardEvent, ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface StatCardTrend {
  readonly direction: 'up' | 'down' | 'flat';
  readonly value: string;
}

export interface StatCardProps {
  readonly icon?: ReactNode;
  readonly label: string;
  readonly value: string | number | ReactNode;
  readonly description?: string | ReactNode;
  readonly trend?: StatCardTrend;
  readonly statusBadge?: ReactNode;
  readonly onClick?: () => void;
}

// Direction → (icon, color class) lookup. Colors chosen to match kpi-card.tsx
// conventions elsewhere in the codebase (raw tailwind palette — no semantic
// `text-success` / `text-destructive` tokens exist in this project's theme).
// Each color pairs a light-mode and a dark-mode class so the trend is legible
// on both themes.
const TREND_CONFIG = {
  up: {
    Icon: TrendingUp,
    className: 'text-green-600 dark:text-green-400',
  },
  down: {
    Icon: TrendingDown,
    className: 'text-red-600 dark:text-red-400',
  },
  flat: {
    Icon: Minus,
    className: 'text-gray-500 dark:text-gray-400',
  },
} as const;

export function StatCard({
  icon,
  label,
  value,
  description,
  trend,
  statusBadge,
  onClick,
}: StatCardProps) {
  const isInteractive = onClick !== undefined;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onClick === undefined) return;
    if (e.key === 'Enter' || e.key === ' ') {
      // Space scrolls the page by default — preventDefault keeps the card's
      // activation behavior consistent with native <button> semantics.
      e.preventDefault();
      onClick();
    }
  };

  const interactiveProps = isInteractive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: handleKeyDown,
        'aria-label': label,
      }
    : {};

  const trendConfig = trend ? TREND_CONFIG[trend.direction] : null;
  const TrendIcon = trendConfig?.Icon;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 text-card-foreground',
        isInteractive &&
          'cursor-pointer transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      {...interactiveProps}
    >
      {/* Top row: icon + label (left) · statusBadge (right) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        {statusBadge !== undefined && <div>{statusBadge}</div>}
      </div>

      {/* Main value */}
      <div className="mt-2 text-2xl font-semibold">{value}</div>

      {/* Bottom row: description (left) · trend (right) — renders only when
          at least one of the two is present so we don't emit an empty flex
          row that contributes padding to the card. */}
      {(description !== undefined || trend !== undefined) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {description !== undefined ? description : null}
          </div>
          {trend !== undefined && trendConfig && TrendIcon && (
            <div
              data-testid="stat-card-trend"
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trendConfig.className
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{trend.value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
