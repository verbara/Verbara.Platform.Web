// Licensed-agents card of the licence page (host change `licensed-agent-metering`, slice 3).
//
// Reads `GET /api/v1/management/licensing/agents` for the month picked in the month selector and
// shows the deployment's peak against the licence's advisory `maxAgents` band, the per-tenant
// breakdown of the peak day, a warning-only advisory when the server says `overBand`, and the
// ledger export of the same month.
//
// What it deliberately does NOT do (design Non-Goals): render any other `days[]` entry, any hash
// field (`deploymentRowHash`, `rowHash`, `chainHeads`) or verify the chain in the browser; recompute
// `overBand`; block or disable anything on the band.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, TriangleAlert, Users } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { UsageMeter } from '@/core/ui/usage-meter';
import { useFormatDate, useFormatNumber } from '@/core/i18n/use-format';
import {
  useLicensedAgentExport,
  useLicensedAgentPeaks,
  type LicensedAgentPeaks,
} from '@/core/api/hooks/use-system';

import { isMonthInProgress, recentLicenseMonths, type LicenseMonth } from './license-months';
import { peakDayTenants } from './peak-day-tenants';

export interface LicensedAgentsCardProps {
  /** The current day; injectable for tests. Defaults to now, in the browser's time zone. */
  readonly today?: Date;
}

export function LicensedAgentsCard({ today = new Date() }: LicensedAgentsCardProps = {}) {
  const { t } = useTranslation(['admin']);
  const { formatDate } = useFormatDate();
  const { formatNumber } = useFormatNumber();

  const months = recentLicenseMonths(today);
  // `months` is never empty (LICENSE_MONTH_COUNT >= 1); the current month is its first entry.
  const [selected, setSelected] = useState<LicenseMonth>(() => months[0]!);
  const range = { from: selected.from, to: selected.to };

  const { data: peaks, isLoading, isError } = useLicensedAgentPeaks(range);
  const exportMutation = useLicensedAgentExport();

  const inProgress = isMonthInProgress(selected, today);
  const monthLabel = (m: LicenseMonth) => formatDate(m.start, 'LLLL yyyy');

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" data-testid="license-agents-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden="true" />
            {t('admin:license.agents.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('admin:license.agents.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selected.value}
            items={months.map((m) => ({ value: m.value, label: monthLabel(m) }))}
            onValueChange={(value) => {
              const next = months.find((m) => m.value === value);
              if (next) setSelected(next);
            }}
          >
            <SelectTrigger
              className="min-w-40"
              aria-label={t('admin:license.agents.month_label')}
              data-testid="license-agents-month-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value} data-month={m.value}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            data-testid="license-agents-export-button"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate(range)}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('admin:license.agents.export')}
          </Button>
        </div>
      </div>

      {inProgress && (
        <p className="text-xs text-muted-foreground" data-testid="license-agents-month-in-progress">
          {t('admin:license.agents.month_in_progress')}
        </p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t('admin:license.agents.loading')}</p>
      )}
      {isError && (
        <p className="text-sm text-destructive" data-testid="license-agents-error">
          {t('admin:license.agents.error')}
        </p>
      )}

      {peaks && (
        <LicensedAgentsFigures
          peaks={peaks}
          formatDay={(day) => formatDate(day, 'PP')}
          formatNumber={formatNumber}
        />
      )}
    </section>
  );
}

interface FiguresProps {
  readonly peaks: LicensedAgentPeaks;
  readonly formatDay: (day: string) => string;
  readonly formatNumber: (n: number) => string;
}

function LicensedAgentsFigures({ peaks, formatDay, formatNumber }: FiguresProps) {
  const { t } = useTranslation(['admin']);
  const { deployment, license } = peaks;
  const maxAgents = license.maxAgents;
  const declared = maxAgents != null && maxAgents > 0;
  const tenants = peakDayTenants(peaks);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground" data-testid="license-agents-day-zone">
        {t('admin:license.agents.day_zone', { zone: peaks.dayZone })}
      </p>

      {/* Advisory only: the server's `overBand` as given, amber, never disabling a control. */}
      {deployment.overBand && (
        <div
          data-testid="license-agents-advisory-banner"
          data-i18n-key="admin:license.agents.advisory"
          role="status"
          className="flex items-start gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('admin:license.agents.advisory')}
        </div>
      )}

      {deployment.peakDay == null ? (
        <p className="text-sm text-muted-foreground" data-testid="license-agents-empty">
          {t('admin:license.agents.empty')}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {t('admin:license.agents.peak_label')}
                </p>
                <p className="text-2xl font-semibold" data-testid="license-agents-peak">
                  {formatNumber(deployment.peakLicensedAgents)}
                  {declared && (
                    <span
                      className="ml-1 text-base font-normal text-muted-foreground"
                      data-testid="license-agents-band"
                    >
                      / {formatNumber(maxAgents)}
                    </span>
                  )}
                </p>
              </div>
              <p
                className="text-xs text-muted-foreground"
                data-testid="license-agents-peak-day"
                data-day={deployment.peakDay}
              >
                {t('admin:license.agents.peak_day', { day: formatDay(deployment.peakDay) })}
              </p>
            </div>
            {declared ? (
              <UsageMeter
                value={deployment.peakLicensedAgents}
                limit={maxAgents}
                tone="advisory"
                label={t('admin:license.agents.band', { max: formatNumber(maxAgents) })}
                data-testid="license-agents-meter"
              />
            ) : (
              <p
                className="text-xs text-muted-foreground"
                data-testid="license-agents-not-declared"
              >
                {t('admin:license.agents.not_declared')}
              </p>
            )}
          </div>

          {tenants && (
            <div className="space-y-2" data-testid="license-agents-tenant-breakdown">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('admin:license.agents.breakdown_title')}
              </p>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-medium">
                      {t('admin:license.agents.breakdown_tenant')}
                    </th>
                    <th className="py-1 text-right font-medium">
                      {t('admin:license.agents.breakdown_agents')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr
                      key={tenant.tenantId}
                      className="border-t"
                      data-tenant-id={tenant.tenantId}
                      data-licensed-agents={tenant.licensedAgents}
                    >
                      <td className="py-1 text-foreground">{tenant.tenantName}</td>
                      <td className="py-1 text-right font-mono">
                        {formatNumber(tenant.licensedAgents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
