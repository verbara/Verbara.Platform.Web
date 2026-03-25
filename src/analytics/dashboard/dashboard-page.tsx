import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiCard } from './kpi-card';
import { TrendChart } from './trend-chart';
import { OverlayChart, type OverlayChartPoint } from './overlay-chart';
import { Heatmap, type HeatmapCell } from './heatmap';
import { FilterBar, type FilterState } from '@/analytics/shared/filter-bar';
import { useDashboard, useIntervals, type DashboardKpis } from '@/core/api/hooks/use-analytics';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatWait(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}

function formatHandle(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function computeDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default function DashboardPage() {
  const { t } = useTranslation('analytics');

  const [filters, setFilters] = useState<FilterState>({
    from: daysAgo(7),
    to: todayStr(),
    queue: '',
    agent: '',
    channel: '',
  });

  const { data, isLoading } = useDashboard(filters.from, filters.to, filters.queue || undefined);
  const { data: intervalsData } = useIntervals(filters.from, filters.to, filters.queue || undefined);

  const kpis = data?.kpis;
  const prev = data?.previousPeriodKpis;

  const kpiDeltas = (current: DashboardKpis | undefined, previous: DashboardKpis | undefined) => {
    if (!current || !previous) return { handled: undefined, wait: undefined, handle: undefined, sla: undefined };
    return {
      handled: computeDelta(current.conversationsHandled, previous.conversationsHandled),
      wait: computeDelta(current.avgWaitMs, previous.avgWaitMs),
      handle: computeDelta(current.avgHandleTimeMs, previous.avgHandleTimeMs),
      sla: computeDelta(current.slaPercent, previous.slaPercent),
    };
  };

  const deltas = kpiDeltas(kpis, prev);

  const volumeData = (data?.volumeTrend ?? []).map((p) => ({ name: p.label, value: p.value }));
  const slaTrendData = (data?.slaTrend ?? []).map((p) => ({ name: p.label, value: p.value }));
  const channelData = (data?.channelDistribution ?? []).map((d) => ({ name: d.channel, value: d.count }));

  // Overlay chart: zip volumeTrend + slaTrend by index (same labels expected)
  const overlayData: OverlayChartPoint[] = (data?.volumeTrend ?? []).map((p, i) => ({
    label: p.label,
    volume: p.value,
    slaPercent: data?.slaTrend?.[i]?.value ?? 0,
  }));

  // Heatmap: derive hour×day distribution from interval snapshots when available
  const heatmapData: HeatmapCell[] = (intervalsData ?? []).map((row) => {
    const d = new Date(row.intervalStart);
    // getDay() → 0=Sun … 6=Sat; remap to 0=Mon … 6=Sun
    const rawDay = d.getDay();
    const dayOfWeek = rawDay === 0 ? 6 : rawDay - 1;
    return { dayOfWeek, hour: d.getHours(), value: row.callsAnswered };
  });

  return (
    <div className="space-y-6">
      <FilterBar onFilterChange={setFilters} />

      <div className="px-6 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('dashboard.title')}
        </h1>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('dashboard.conversations_handled')}
              value={kpis ? kpis.conversationsHandled.toLocaleString() : '—'}
              delta={deltas.handled}
              deltaLabel={prev ? t('dashboard.vs_prev_period') : undefined}
            />
            <KpiCard
              label={t('dashboard.avg_wait')}
              value={kpis ? formatWait(kpis.avgWaitMs) : '—'}
              delta={deltas.wait}
              deltaLabel={prev ? t('dashboard.vs_prev_period') : undefined}
            />
            <KpiCard
              label={t('dashboard.avg_handle')}
              value={kpis ? formatHandle(kpis.avgHandleTimeMs) : '—'}
              delta={deltas.handle}
              deltaLabel={prev ? t('dashboard.vs_prev_period') : undefined}
            />
            <KpiCard
              label={t('dashboard.sla_percent')}
              value={kpis ? `${kpis.slaPercent.toFixed(0)}%` : '—'}
              delta={deltas.sla}
              deltaLabel={prev ? t('dashboard.vs_prev_period') : undefined}
            />
          </div>
        )}

        {/* Charts */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrendChart
              title={t('dashboard.volume_trend')}
              type="area"
              data={volumeData}
              dataKey="value"
            />
            <TrendChart
              title={t('dashboard.sla_trend')}
              type="line"
              data={slaTrendData}
              dataKey="value"
              color="#22c55e"
            />
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TrendChart
              title={t('dashboard.channel_distribution')}
              type="pie"
              data={channelData}
              dataKey="value"
            />
          </div>
        )}

        {/* Volume vs SLA overlay chart */}
        {isLoading ? (
          <div className="h-[348px] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700" />
        ) : (
          <OverlayChart
            title={t('dashboard.volume_vs_sla')}
            data={overlayData}
            volumeLabel={t('dashboard.volume_label')}
            slaLabel={t('dashboard.sla_label')}
            emptyLabel={t('dashboard.no_data')}
          />
        )}

        {/* Call volume heatmap */}
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700" />
        ) : (
          <Heatmap
            title={t('dashboard.heatmap_title')}
            data={heatmapData}
            dayLabels={[
              t('dashboard.day_mon'),
              t('dashboard.day_tue'),
              t('dashboard.day_wed'),
              t('dashboard.day_thu'),
              t('dashboard.day_fri'),
              t('dashboard.day_sat'),
              t('dashboard.day_sun'),
            ]}
            emptyLabel={t('dashboard.no_data')}
          />
        )}
      </div>
    </div>
  );
}
