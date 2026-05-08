import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { TrendingUp, DollarSign, Users, FileText, Download } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Button } from '@/core/ui/button';
import {
  usePartnerRevenueSummary,
  usePartnerRevenueDetails,
  type PartnerRevenueDetail,
} from '@/core/api/hooks/use-partner';
import { useFormatNumber } from '@/core/i18n/use-format';

const col = createColumnHelper<PartnerRevenueDetail>();

function marginColor(pct: number): string {
  if (pct >= 30) return 'text-green-600 dark:text-green-400';
  if (pct >= 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function buildCsv(details: PartnerRevenueDetail[]): string {
  const header = [
    'revenueId',
    'customerTenantId',
    'invoiceId',
    'grossAmount',
    'platformCost',
    'partnerMargin',
    'marginPct',
    'periodStart',
    'periodEnd',
  ].join(',');

  const rows = details.map((r) => {
    const pct = r.grossAmount > 0 ? (r.partnerMargin / r.grossAmount) * 100 : 0;
    return [
      csvEscape(r.revenueId),
      csvEscape(r.customerTenantId),
      csvEscape(r.invoiceId),
      csvEscape(r.grossAmount),
      csvEscape(r.platformCost),
      csvEscape(r.partnerMargin),
      csvEscape(pct.toFixed(2)),
      csvEscape(r.periodStart),
      csvEscape(r.periodEnd),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

interface TrendPoint {
  date: string;
  revenue: number;
  margin: number;
}

function buildTrendSeries(details: PartnerRevenueDetail[]): TrendPoint[] {
  // Aggregate by periodStart day. Each row represents a billing period; bucket
  // by the start date so rows with overlapping periods stack on the same day.
  const buckets = new Map<string, { revenue: number; margin: number }>();
  for (const r of details) {
    const key = r.periodStart.slice(0, 10); // YYYY-MM-DD
    const cur = buckets.get(key) ?? { revenue: 0, margin: 0 };
    cur.revenue += r.grossAmount;
    cur.margin += r.partnerMargin;
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, revenue: v.revenue, margin: v.margin }));
}

export default function PartnerRevenuePage() {
  const { t } = useTranslation('admin');
  const { formatCurrency } = useFormatNumber();
  const navigate = useNavigate();

  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>();
  const [appliedUntil, setAppliedUntil] = useState<string | undefined>();

  const { data: summary } = usePartnerRevenueSummary(appliedFrom, appliedUntil);
  const { data: details = [] } = usePartnerRevenueDetails(appliedFrom, appliedUntil);

  function applyFilter() {
    setAppliedFrom(from ? new Date(from).toISOString() : undefined);
    setAppliedUntil(until ? new Date(until).toISOString() : undefined);
  }

  function clearFilter() {
    setFrom('');
    setUntil('');
    setAppliedFrom(undefined);
    setAppliedUntil(undefined);
  }

  const handleExportCsv = useCallback(() => {
    const csv = buildCsv(details);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filenameSuffix =
      appliedFrom || appliedUntil
        ? `_${(appliedFrom ?? '').slice(0, 10)}_${(appliedUntil ?? '').slice(0, 10)}`
        : '';
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner-revenue${filenameSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [details, appliedFrom, appliedUntil]);

  const handleRowClick = useCallback(
    (row: PartnerRevenueDetail) => {
      const params = new URLSearchParams();
      if (appliedFrom) params.set('from', appliedFrom);
      if (appliedUntil) params.set('until', appliedUntil);
      const qs = params.toString();
      const suffix = qs ? `?${qs}` : '';
      const target = `/admin/partner/customers/${row.customerTenantId}${suffix}`;
      navigate(target);
    },
    [navigate, appliedFrom, appliedUntil],
  );

  const trendData = useMemo(() => buildTrendSeries(details), [details]);

  // Track first occurrence of each customer so the drill-down testid is unique
  // even when a customer appears in multiple rows.
  const firstRowIdByCustomer = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of details) {
      if (!m.has(r.customerTenantId)) {
        m.set(r.customerTenantId, r.revenueId);
      }
    }
    return m;
  }, [details]);

  const columns = useMemo(
    () => [
      col.accessor('customerTenantId', {
        header: () => t('partner.revenue.col.customer', 'Customer'),
        cell: (info) => {
          const r = info.row.original;
          const isFirst = firstRowIdByCustomer.get(r.customerTenantId) === r.revenueId;
          return (
            <span
              className="font-mono text-xs"
              data-testid={isFirst ? `revenue-row-${r.customerTenantId}` : undefined}
            >
              {info.getValue()}
            </span>
          );
        },
      }),
      col.accessor('invoiceId', {
        header: () => t('partner.revenue.col.invoice', 'Invoice'),
        cell: (info) => <span className="font-mono text-xs">{info.getValue().slice(0, 8)}...</span>,
      }),
      col.accessor('grossAmount', {
        header: () => t('partner.revenue.col.gross', 'Gross'),
        cell: (info) => <span>{formatCurrency(info.getValue(), 'USD')}</span>,
      }),
      col.accessor('platformCost', {
        header: () => t('partner.revenue.col.cost', 'Cost'),
        cell: (info) => (
          <span className="text-muted-foreground">{formatCurrency(info.getValue(), 'USD')}</span>
        ),
      }),
      col.accessor('partnerMargin', {
        header: () => t('partner.revenue.col.margin', 'Margin'),
        cell: (info) => (
          <span className="font-medium">{formatCurrency(info.getValue(), 'USD')}</span>
        ),
      }),
      col.display({
        id: 'marginPct',
        header: () => t('partner.revenue.col.marginPct', 'Margin %'),
        cell: ({ row }) => {
          const r = row.original;
          const pct = r.grossAmount > 0 ? (r.partnerMargin / r.grossAmount) * 100 : 0;
          return (
            <span
              className={`font-semibold ${marginColor(pct)}`}
              data-testid={`margin-${r.revenueId}`}
            >
              {pct.toFixed(1)}%
            </span>
          );
        },
      }),
      col.accessor('periodStart', {
        header: () => t('partner.revenue.col.period', 'Period'),
        cell: (info) => {
          const r = info.row.original;
          return (
            <span className="text-xs">
              {format(new Date(r.periodStart), 'MMM d')} —{' '}
              {format(new Date(r.periodEnd), 'MMM d, yyyy')}
            </span>
          );
        },
      }),
    ],
    [t, firstRowIdByCustomer, formatCurrency],
  );

  return (
    <div className="space-y-6" data-testid="partner-revenue-page">
      <PageHeader
        title={t('partner.revenue.title', 'Revenue')}
        description={t(
          'partner.revenue.description',
          'Track revenue and margin across all your customers.',
        )}
      />

      {/* Date range filter */}
      <div className="flex items-end gap-3 rounded-md border bg-muted/30 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="rev-from" className="text-xs">
            {t('partner.revenue.from', 'From')}
          </Label>
          <Input
            id="rev-from"
            type="date"
            data-testid="revenue-from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rev-until" className="text-xs">
            {t('partner.revenue.until', 'Until')}
          </Label>
          <Input
            id="rev-until"
            type="date"
            data-testid="revenue-until"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={applyFilter} data-testid="apply-revenue-filter">
          {t('partner.revenue.apply', 'Apply')}
        </Button>
        {(appliedFrom || appliedUntil) && (
          <Button variant="ghost" onClick={clearFilter} data-testid="clear-revenue-filter">
            {t('partner.revenue.clear', 'Clear')}
          </Button>
        )}
        <div className="ml-auto">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={details.length === 0}
            data-testid="revenue-csv-export"
          >
            <Download className="mr-2 h-4 w-4" />
            {t('partner.revenue.exportCsv', 'Export CSV')}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label={t('partner.revenue.summary.totalRevenue', 'Total revenue')}
          value={summary ? formatCurrency(summary.totalGross, 'USD') : '—'}
          testid="revenue-total-gross"
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label={t('partner.revenue.summary.platformCost', 'Platform cost')}
          value={summary ? formatCurrency(summary.totalPlatformCost, 'USD') : '—'}
          muted
          testid="revenue-total-cost"
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label={t('partner.revenue.summary.yourMargin', 'Your margin')}
          value={summary ? formatCurrency(summary.totalMargin, 'USD') : '—'}
          highlight
          testid="revenue-total-margin"
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label={t('partner.revenue.summary.customersInvoices', 'Customers / invoices')}
          value={summary ? `${summary.customerCount} / ${summary.invoiceCount}` : '—'}
          testid="revenue-counts"
          subIcon={<FileText className="h-3 w-3 inline ml-1" />}
        />
      </div>

      {/* Trend chart */}
      <div className="rounded-md border p-4" data-testid="revenue-trend-chart">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {t('partner.revenue.chart.title', 'Revenue & margin trend')}
        </h2>
        {trendData.length === 0 ? (
          <p
            className="py-8 text-center text-sm text-muted-foreground"
            data-testid="revenue-chart-empty"
          >
            {t('partner.revenue.chart.empty', 'No trend data for the selected period.')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={trendData}
              width={800}
              height={260}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                name={t('partner.revenue.chart.revenue', 'Revenue')}
                stroke="var(--color-brand, #2563eb)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                className="recharts-line-revenue"
              />
              <Line
                type="monotone"
                dataKey="margin"
                name={t('partner.revenue.chart.margin', 'Margin')}
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                className="recharts-line-margin"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          {t('partner.revenue.detailsHeading', 'Revenue details')}
        </h2>
        {details.length === 0 ? (
          <p
            className="rounded-md border p-6 text-center text-sm text-muted-foreground"
            data-testid="revenue-empty"
          >
            {t('partner.revenue.empty', 'No revenue records for the selected period.')}
          </p>
        ) : (
          <DataTable
            data={details}
            columns={columns}
            searchPlaceholder={t(
              'partner.revenue.searchPlaceholder',
              'Search by customer or invoice...',
            )}
            onRowClick={handleRowClick}
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  muted = false,
  highlight = false,
  testid,
  subIcon,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
  testid: string;
  subIcon?: React.ReactNode;
}>) {
  let valueClass = 'text-2xl font-semibold';
  if (highlight) valueClass += ' text-green-600 dark:text-green-400';
  else if (muted) valueClass += ' text-muted-foreground';
  return (
    <div className="rounded-md border p-4" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`mt-2 ${valueClass}`}>
        {value}
        {subIcon}
      </p>
    </div>
  );
}
