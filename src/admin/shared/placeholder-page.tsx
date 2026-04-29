import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';

export interface PlaceholderPageProps {
  /** Localised page title shown in the header. */
  title: string;
  /**
   * Internal feature identifier surfaced in the placeholder body —
   * helps reviewers spot stub pages during release QA.
   */
  featureName: string;
  /** Optional localised description (defaults to a generic message). */
  description?: string;
}

/**
 * Minimal placeholder used by routes that have been pre-registered in Phase 0
 * of a release but whose full implementation lands in a later phase / subagent.
 *
 * Pattern: Phase 0 ships routes + sidebar + i18n stubs all at once so that
 * Phase A/B/C subagents can each implement an isolated page without touching
 * the shared `router.tsx` / `sidebar.tsx` / locale JSONs concurrently.
 *
 * Once a feature subagent replaces the placeholder, simply swap the import
 * in `router.tsx` to point at the real page component.
 */
export function PlaceholderPage({ title, featureName, description }: Readonly<PlaceholderPageProps>) {
  const { t } = useTranslation('admin');
  return (
    <div className="space-y-6 p-2" data-testid="placeholder-page">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <Construction className="h-10 w-10 text-slate-400" aria-hidden />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('shared.placeholder_pending')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">
            {featureName}
          </code>
        </p>
      </div>
    </div>
  );
}
