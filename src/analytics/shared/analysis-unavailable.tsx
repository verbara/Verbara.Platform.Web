import { useTranslation } from 'react-i18next';
import type { QaUnavailableReason } from '@/core/api/hooks/use-analytics';

interface AnalysisUnavailableProps {
  reason: QaUnavailableReason;
  /** Locale-proof handle for tests: the page names its own state. */
  testId: string;
}

/**
 * The state a page renders instead of results that cannot exist (design D2): it names why, in
 * the user's locale, and carries the reason in `data-reason` for locale-proof selectors.
 */
export function AnalysisUnavailable({ reason, testId }: AnalysisUnavailableProps) {
  const { t } = useTranslation('analytics');
  return (
    <div
      role="status"
      data-testid={testId}
      data-reason={reason}
      className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center text-sm text-muted-foreground dark:border-slate-600"
    >
      {t(`availability.${reason}`)}
    </div>
  );
}
