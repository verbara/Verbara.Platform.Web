import { useTranslation } from 'react-i18next';
import { useAiCredits } from '@/core/api/hooks/use-typification-llm';
import { useFormatNumber, useFormatDate } from '@/core/i18n/use-format';
import { Skeleton } from '@/core/ui/skeleton';

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

  return (
    <div
      className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground"
      data-testid="llm-ai-credits-readout"
    >
      <div className="text-sm font-medium">{t('admin:typification.aiCredits.title')}</div>

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

      <p className="text-xs text-muted-foreground">
        {t('admin:typification.aiCredits.periodEnd', { date: formatDateShort(data.periodEnd) })}
      </p>
    </div>
  );
}
