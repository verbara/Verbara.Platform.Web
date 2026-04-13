import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { ExportButton } from '@/analytics/shared/export-button';
import { DateRangePicker, type DateRange } from '@/analytics/shared/date-range-picker';
import { useIntervals, type IntervalData } from '@/core/api/hooks/use-analytics';
import { useQueues } from '@/core/api/hooks/use-queues';

const PAGE_SIZE = 50;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatSeconds(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function SlaCell({ value }: { value: number }) {
  const formatted = `${value.toFixed(1)}%`;
  const color =
    value >= 80
      ? 'text-green-600 dark:text-green-400'
      : value >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  return <span className={`font-medium ${color}`}>{formatted}</span>;
}

type SortKey = keyof IntervalData;
type SortDir = 'asc' | 'desc';

function sortData(data: IntervalData[], key: SortKey, dir: SortDir): IntervalData[] {
  return [...data].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    const cmp = av < bv ? -1 : 1;
    return dir === 'asc' ? cmp : -cmp;
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300 dark:text-slate-600">↕</span>;
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function IntervalPage() {
  const { t } = useTranslation('analytics');
  const { data: queues = [] } = useQueues();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: daysAgo(7),
    to: todayStr(),
  });
  const [queue, setQueue] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('intervalStart');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: rawData = [], isLoading } = useIntervals(
    dateRange.from,
    dateRange.to,
    queue || undefined,
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [dateRange, queue]);

  const sorted = useMemo(() => sortData(rawData, sortKey, sortDir), [rawData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const handleExport = useCallback(() => {
    const headers = [
      t('intervals.col_time_slot'),
      t('intervals.col_queue'),
      t('intervals.col_offered'),
      t('intervals.col_answered'),
      t('intervals.col_abandoned'),
      t('intervals.col_sla'),
      t('intervals.col_asa'),
      t('intervals.col_aht'),
    ];
    const csvRows = [
      headers.join(','),
      ...sorted.map((r) =>
        [
          formatDateTime(r.intervalStart),
          r.queueName,
          r.callsOffered,
          r.callsAnswered,
          r.callsAbandoned,
          `${r.slaPercent.toFixed(1)}%`,
          formatSeconds(r.asaMs),
          formatSeconds(r.ahtMs),
        ].join(','),
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'intervals-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, t]);

  const thClass =
    'select-none cursor-pointer whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';
  const tdClass = 'px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200';

  const columns: { key: SortKey; labelKey: string }[] = [
    { key: 'intervalStart', labelKey: 'intervals.col_time_slot' },
    { key: 'queueName', labelKey: 'intervals.col_queue' },
    { key: 'callsOffered', labelKey: 'intervals.col_offered' },
    { key: 'callsAnswered', labelKey: 'intervals.col_answered' },
    { key: 'callsAbandoned', labelKey: 'intervals.col_abandoned' },
    { key: 'slaPercent', labelKey: 'intervals.col_sla' },
    { key: 'asaMs', labelKey: 'intervals.col_asa' },
    { key: 'ahtMs', labelKey: 'intervals.col_aht' },
  ];

  return (
    <div className="space-y-4" data-testid="interval-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('intervals.title')}
        </h1>
        <span data-testid="interval-export-btn"><ExportButton onClick={handleExport} /></span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800" data-testid="interval-filters">
        <DateRangePicker value={dateRange} onChange={setDateRange} />

        <select
          value={queue}
          onChange={(e) => setQueue(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        >
          <option value="">{t('filters.queue')}</option>
          {queues.map((q) => (
            <option key={q.id} value={q.name}>
              {q.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {t('intervals.loading')}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div
          data-testid="interval-table"
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-16 dark:border-slate-700"
        >
          <p className="text-sm text-muted-foreground">{t('intervals.empty')}</p>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700" data-testid="interval-table">
          <table className="w-full min-w-[720px] border-collapse bg-white dark:bg-slate-900">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                {columns.map(({ key, labelKey }) => (
                  <th
                    key={key}
                    className={thClass}
                    onClick={() => handleSort(key)}
                  >
                    {t(labelKey)}
                    <SortIcon active={sortKey === key} dir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {pageData.map((row, idx) => (
                <tr
                  key={`${row.queueName}-${row.intervalStart}-${idx}`}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className={tdClass}>{formatDateTime(row.intervalStart)}</td>
                  <td className={tdClass}>{row.queueName}</td>
                  <td className={tdClass}>{row.callsOffered}</td>
                  <td className={tdClass}>{row.callsAnswered}</td>
                  <td className={tdClass}>{row.callsAbandoned}</td>
                  <td className={tdClass}>
                    <SlaCell value={row.slaPercent} />
                  </td>
                  <td className={tdClass}>{formatSeconds(row.asaMs)}</td>
                  <td className={tdClass}>{formatSeconds(row.ahtMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('intervals.showing', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, sorted.length),
              total: sorted.length,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('intervals.prev')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('intervals.page', { page, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('intervals.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
