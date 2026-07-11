import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { Badge } from '@/core/ui/badge';

/**
 * Read-only CSAT template tab for the admin Surveys page (csat-runner 2.4).
 *
 * Surfaces the rating question and the 1–5 scale that drive the webchat capture
 * panel's `surveyId` / `questionId`, so operators can review the template
 * without editing it. Copy resolves through the `admin.surveys.csat.*` i18n
 * keys (3-locale parity gate); the scale is shown via the base-ui-backed
 * {@link Badge} (which renders through `@base-ui/react`'s `useRender` contract,
 * never `asChild`). Interactive/labelled elements carry `data-*` selectors.
 */
export function CsatTemplateTab() {
  const { t } = useTranslation(['admin']);

  return (
    <div
      className="space-y-4 rounded-lg border border-slate-200 p-5 dark:border-slate-700"
      data-testid="csat-template-tab"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t('admin:surveys.csat.tab')}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('admin:surveys.csat.tabDescription')}
        </p>
      </div>

      <dl className="space-y-3">
        <div className="flex flex-col gap-1" data-testid="csat-template-rating-question">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t('admin:surveys.csat.ratingQuestion')}
          </dt>
          <dd className="flex items-center gap-2 text-sm text-slate-900 dark:text-white">
            <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {t('admin:surveys.csat.ratingQuestionText')}
          </dd>
        </div>

        <div className="flex flex-col gap-1" data-testid="csat-template-scale">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t('admin:surveys.csat.scaleLabel')}
          </dt>
          <dd>
            <Badge variant="secondary" data-testid="csat-template-scale-value">
              {t('admin:surveys.csat.scaleValue')}
            </Badge>
          </dd>
        </div>
      </dl>

      <p className="text-xs text-slate-400" data-testid="csat-template-readonly-note">
        {t('admin:surveys.csat.readOnlyNote')}
      </p>
    </div>
  );
}
