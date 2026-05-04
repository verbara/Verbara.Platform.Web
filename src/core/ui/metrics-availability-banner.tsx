// R5.2 PC.2 / B.2 — wallboard-level banner shown when the live metrics
// infrastructure is unavailable. Surfaced when the queue metrics endpoint
// returns `X-Metrics-Available: false` (Pro.Analytics.Live writer not running
// OR Postgres unreachable per R5.1 Task G spec). Header parsing happens in
// {@link useQueueMetrics}; this component is a pure presentation primitive.

import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MetricsAvailabilityBannerProps {
  readonly isAvailable: boolean;
}

export function MetricsAvailabilityBanner({ isAvailable }: MetricsAvailabilityBannerProps) {
  const { t } = useTranslation('operations');

  if (isAvailable) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200"
      data-testid="metrics-availability-banner"
      role="status"
    >
      <CircleAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{t('wallboard.metrics_unavailable')}</span>
    </div>
  );
}
