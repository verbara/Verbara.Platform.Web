import { useTranslation } from 'react-i18next';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { SmilePlus } from 'lucide-react';
import { useCsatAggregateAnalytics } from '@/core/api/hooks/use-analytics';
import { useFormatNumber } from '@/core/i18n/use-format';
import { Skeleton } from '@/core/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Card shell rendered through the `@base-ui/react` `useRender` contract (the
 * repo's `render`-prop idiom for non-interactive primitives — mirrors
 * `core/ui/badge.tsx`), never `asChild`.
 */
function CsatCardShell({ className, render, ...props }: useRender.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800',
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: 'csat-kpi-card' },
  });
}

/**
 * Supervisor CSAT KPI card for the Operations wallboard (csat-completion).
 *
 * Reads the scope-wide aggregate `GET /api/v1/analytics/csat` (NOT a single
 * queue) and renders the envelope roll-up: `averageRating` as the score and
 * `totalResponses` as the count for the `rangeStart`–`rangeEnd` window,
 * aggregated across all queues in the supervisor's scope (fulfilling the
 * `csat-operator-views` living-spec promise). Shows an empty/placeholder state
 * (rather than a misleading zero) when there are no responses yet — emptiness
 * is derived from `totalResponses === 0`, never from a zero `averageRating`.
 * The card takes no props (the scope is server-computed); the `OnCsatResponseRecorded`
 * SignalR push invalidates this query so the score refreshes without waiting
 * for the poll. All copy resolves through the `operations.csat.*` i18n keys
 * (3-locale parity gate); numeric values are locale-formatted via `Intl`.
 */
export function CsatKpiCard() {
  const { t } = useTranslation('operations');
  const { formatNumber } = useFormatNumber();
  const { data, isLoading } = useCsatAggregateAnalytics();

  if (isLoading) {
    return (
      <div data-testid="csat-kpi-card-loading">
        <Skeleton variant="rectangular" className="h-28" />
      </div>
    );
  }

  // Platform returns `averageRating: 0` (not null) when there are no responses,
  // so emptiness is derived from the count — never from a "zero" score.
  const hasResponses = !!data && data.totalResponses > 0;

  return (
    <CsatCardShell data-testid="csat-kpi-card">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500">
          <SmilePlus className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {t('csat.title')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500" data-testid="csat-kpi-scope">
            {t('csat.scope')}
          </p>
          {hasResponses ? (
            <p
              className="text-2xl font-bold text-slate-900 dark:text-white"
              data-testid="csat-kpi-score"
            >
              {formatNumber(data.averageRating)}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="csat-kpi-empty">
              {t('csat.empty')}
            </p>
          )}
        </div>
      </div>

      {hasResponses && (
        <p className="mt-3 text-xs text-slate-500" data-testid="csat-kpi-responses">
          {t('csat.responses')}: {formatNumber(data.totalResponses)}
        </p>
      )}
    </CsatCardShell>
  );
}
