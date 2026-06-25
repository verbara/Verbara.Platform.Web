import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAiCredits } from '@/core/api/hooks/use-typification-llm';
import { useFormatNumber, useFormatDate } from '@/core/i18n/use-format';
import { Badge } from '@/core/ui/badge';
import { Skeleton } from '@/core/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Maps each known `QuotaAction` (the server's `actionOnExhaustion` values) to a
 * per-value color treatment and the i18n label suffix. An unrecognised string
 * is NOT in this table — callers fall back to a neutral badge + the raw value
 * so a future server-side action never blanks out the readout.
 */
const ACTION_ON_EXHAUSTION = {
  Warn: {
    labelKey: 'warn',
    className: 'border-transparent bg-blue-500/20 text-blue-700 dark:text-blue-400',
  },
  SoftBlock: {
    labelKey: 'softBlock',
    className: 'border-transparent bg-amber-500/20 text-amber-700 dark:text-amber-400',
  },
  HardBlock: {
    labelKey: 'hardBlock',
    className: 'border-transparent bg-red-500/20 text-red-700 dark:text-red-400',
  },
} as const satisfies Record<string, { labelKey: string; className: string }>;

const UNKNOWN_ACTION_CLASS = 'border-transparent bg-muted text-muted-foreground';

/** Usage ratio (server-computed percent) at/above which the warning band shows. */
const NEAR_EXHAUSTION_THRESHOLD = 80;

/**
 * Read-only usage panel for the platform-managed (Verbara) LLM. Surfaces the
 * tenant's credit allowance (or an "unlimited" label when `allowanceCredits`
 * is null), consumed/remaining credits, and a usage bar driven by
 * `usagePercent`. Rendered inside the LLM config form when AI source is
 * PlatformManaged. Pulls its data from {@link useAiCredits}.
 */
export function AiCreditsReadout() {
  const { t } = useTranslation(['admin']);
  const { formatNumber } = useFormatNumber();
  const { formatDateShort } = useFormatDate();
  const { data, isPending } = useAiCredits();

  if (isPending || !data) {
    return (
      <div
        className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground"
        data-testid="llm-ai-credits-readout"
      >
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" variant="rectangular" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  // Allowance/remaining are null for an unlimited plan; show the unlimited label
  // instead of a number and suppress the percentage bar (no meaningful ratio).
  const unlimited = data.allowanceCredits === null;
  // Clamp the bar to [0, 100] — a server-side over-consumption could exceed 100.
  const usageWidth = Math.min(100, Math.max(0, data.usagePercent));

  // Resolve the exhaustion action to a known color + label, or fall back to a
  // neutral badge rendering the raw server string for an unrecognised value.
  const knownAction =
    ACTION_ON_EXHAUSTION[data.actionOnExhaustion as keyof typeof ACTION_ON_EXHAUSTION];
  const actionClassName = knownAction?.className ?? UNKNOWN_ACTION_CLASS;
  const actionLabel = knownAction
    ? t(`admin:typification.aiCredits.actionOnExhaustion.${knownAction.labelKey}`)
    : data.actionOnExhaustion;

  // Near-exhaustion band: only meaningful for a finite allowance (unlimited
  // plans have no ratio to exhaust), and only once usage crosses the threshold.
  const nearExhaustion = !unlimited && data.usagePercent >= NEAR_EXHAUSTION_THRESHOLD;

  return (
    <div
      className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground"
      data-testid="llm-ai-credits-readout"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{t('admin:typification.aiCredits.title')}</div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t('admin:typification.aiCredits.actionOnExhaustion.label')}
          </span>
          <Badge className={cn(actionClassName)} data-testid="llm-ai-credits-action">
            {actionLabel}
          </Badge>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">
            {t('admin:typification.aiCredits.allowance')}
          </dt>
          <dd className="font-medium" data-testid="llm-ai-credits-allowance">
            {unlimited
              ? t('admin:typification.aiCredits.unlimited')
              : formatNumber(data.allowanceCredits as number)}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">
            {t('admin:typification.aiCredits.consumed')}
          </dt>
          <dd className="font-medium" data-testid="llm-ai-credits-consumed">
            {formatNumber(data.consumedCredits)}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">
            {t('admin:typification.aiCredits.remaining')}
          </dt>
          <dd className="font-medium" data-testid="llm-ai-credits-remaining">
            {unlimited
              ? t('admin:typification.aiCredits.unlimited')
              : formatNumber(data.remainingCredits as number)}
          </dd>
        </div>
      </dl>

      {!unlimited && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('admin:typification.aiCredits.usage')}</span>
            <span data-testid="llm-ai-credits-usage-percent">{`${Math.round(data.usagePercent)}%`}</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(data.usagePercent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${usageWidth}%` }} />
          </div>
        </div>
      )}

      {nearExhaustion && (
        <div
          className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200"
          data-testid="llm-ai-credits-near-exhaustion"
          role="status"
        >
          <CircleAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>
            {t('admin:typification.aiCredits.nearExhaustion', {
              percent: Math.round(data.usagePercent),
            })}
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('admin:typification.aiCredits.periodEnd', { date: formatDateShort(data.periodEnd) })}
      </p>
    </div>
  );
}
