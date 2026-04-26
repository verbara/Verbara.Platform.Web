// R5.2 PC.1 — admin retention policy page. DryRun toggle (PlatformAdmin only) +
// per-target overview table + manual run-now (dry-run / purge with ConfirmDialog).
//
// Backend: /api/v1/management/retention/* (retention.read | retention.manage).

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  useRetentionConfig,
  useRetentionTargets,
  useRunRetentionNow,
  useToggleDryRun,
  type RetentionRunResultDto,
} from './use-retention-targets';

const formatTimestamp = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString() : '—';

export default function RetentionAdminPage() {
  const { t } = useTranslation(['admin']);
  const permissions = useAuthStore((s) => s.permissions);
  const canManage = permissions.has('retention.manage');

  const { data: targets, isLoading: targetsLoading, error: targetsError } = useRetentionTargets();
  const { data: config, isLoading: configLoading } = useRetentionConfig();
  const runRetention = useRunRetentionNow();
  const toggleDryRun = useToggleDryRun();

  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [lastRun, setLastRun] = useState<RetentionRunResultDto | null>(null);

  const onToggleDryRun = (next: boolean) => {
    toggleDryRun.mutate(next);
  };

  const onDryRun = () => {
    runRetention.mutate(
      { dryRun: true },
      { onSuccess: (result) => setLastRun(result) },
    );
  };

  const onPurge = () => {
    setPurgeConfirmOpen(false);
    runRetention.mutate(
      { dryRun: false },
      { onSuccess: (result) => setLastRun(result) },
    );
  };

  if (targetsError) {
    return (
      <div className="p-6">
        <PageHeader title={t('admin:retention.title')} />
        <p className="text-red-600 mt-4" data-testid="retention-error">
          {t('admin:retention.errorLoading', 'Failed to load retention targets.')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="retention-admin-page">
      <PageHeader title={t('admin:retention.title')} />

      {config?.dryRun && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="retention-dryrun-banner"
        >
          {t('admin:retention.dryRunActive', 'Currently in DRY-RUN MODE — no rows will be deleted.')}
        </div>
      )}

      {canManage && config && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.dryRun}
              onChange={(e) => onToggleDryRun(e.target.checked)}
              disabled={toggleDryRun.isPending}
              data-testid="retention-dryrun-toggle"
            />
            <span className="text-sm font-medium">
              {t('admin:retention.dryRunToggle', 'DryRun mode (count only, no delete)')}
            </span>
          </label>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border" data-testid="retention-targets-table">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t('admin:retention.col.name', 'Target')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin:retention.col.table', 'Schema.Table')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin:retention.col.window', 'Window (days)')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin:retention.col.lastRun', 'Last execution')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin:retention.col.status', 'Last status')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('admin:retention.col.rows', 'Rows purged')}</th>
            </tr>
          </thead>
          <tbody>
            {targetsLoading ? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">{t('admin:retention.loading', 'Loading...')}</td></tr>
            ) : !targets || targets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500" data-testid="retention-empty-state">
                  {t('admin:retention.empty', 'No retention targets registered in this deployment.')}
                </td>
              </tr>
            ) : (
              targets.map((target) => (
                <tr key={target.name} className="border-t" data-testid={`retention-target-${target.name}`}>
                  <td className="px-3 py-2 font-medium">{target.name}</td>
                  <td className="px-3 py-2 text-gray-600">{target.schema}.{target.table}</td>
                  <td className="px-3 py-2">{target.windowDays}</td>
                  <td className="px-3 py-2">{formatTimestamp(target.lastExecutionAt)}</td>
                  <td className="px-3 py-2">
                    {target.lastStatus ? (
                      <span className={`text-xs ${target.lastStatus === 'success' ? 'text-green-700' : target.lastStatus === 'error' ? 'text-red-700' : 'text-gray-600'}`}>
                        {target.lastStatus}
                        {target.lastWasDryRun && ' (dry-run)'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{target.lastRowsPurged ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDryRun}
            disabled={runRetention.isPending || configLoading}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            data-testid="retention-run-dryrun"
          >
            {t('admin:retention.runDryRun', 'Run now (dry-run)')}
          </button>
          <button
            type="button"
            onClick={() => setPurgeConfirmOpen(true)}
            disabled={runRetention.isPending || configLoading || (config?.dryRun ?? true)}
            title={config?.dryRun ? t('admin:retention.purgeBlockedByDryRun', 'Disable DryRun first') : ''}
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            data-testid="retention-run-purge"
          >
            {t('admin:retention.runPurge', 'Run now (purge)')}
          </button>
        </div>
      )}

      {lastRun && (
        <div className="rounded-md border bg-gray-50 p-3 text-sm" data-testid="retention-last-run">
          <strong>{t('admin:retention.lastRun', 'Last run')}:</strong>{' '}
          {lastRun.dryRun ? t('admin:retention.dryRun', 'dry-run') : t('admin:retention.purged', 'purged')} ·{' '}
          {lastRun.targets.length} {t('admin:retention.targetsProcessed', 'targets')} ·{' '}
          {lastRun.targets.reduce((sum, target) => sum + target.rowsPurged, 0)} {t('admin:retention.totalRows', 'rows')}
        </div>
      )}

      {purgeConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          data-testid="retention-confirm-purge-dialog"
        >
          <div className="rounded-md bg-white p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold">
              {t('admin:retention.confirmPurgeTitle', 'Confirm purge')}
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              {t('admin:retention.confirmPurgeBody', 'This will permanently delete rows beyond the retention window. Continue?')}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPurgeConfirmOpen(false)}
                className="rounded-md border px-4 py-2 text-sm"
                data-testid="retention-confirm-cancel"
              >
                {t('common:cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={onPurge}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white"
                data-testid="retention-confirm-purge"
              >
                {t('admin:retention.confirmPurgeAction', 'Purge')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
