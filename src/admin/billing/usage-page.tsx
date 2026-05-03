import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format, startOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Trans, useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  useUsageSummary,
  useUsageDetails,
  USAGE_TYPES,
  type UsageRecord,
} from '@/core/api/hooks/use-billing';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { useFormatNumber } from '@/core/i18n/use-format';

const col = createColumnHelper<UsageRecord>();

export default function UsagePage() {
  const { t } = useTranslation('admin');
  const { formatNumber } = useFormatNumber();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const authTenantId = useAuthStore((s) => s.tenantId);
  const tenantId = activeTenantId ?? authTenantId;

  const now = new Date();
  const [from, setFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd'T'HH:mm"));
  const [until, setUntil] = useState(format(now, "yyyy-MM-dd'T'HH:mm"));
  const [typeFilter, setTypeFilter] = useState('all');
  const [detailPage, setDetailPage] = useState(1);

  const fromISO = from ? new Date(from).toISOString() : undefined;
  const untilISO = until ? new Date(until).toISOString() : undefined;

  const { data: summaries = [] } = useUsageSummary(fromISO, untilISO);
  const { data: records = [] } = useUsageDetails({
    from: fromISO,
    until: untilISO,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    page: detailPage,
    pageSize: 50,
  });

  const chartData = useMemo(
    () =>
      summaries.map((s) => ({
        name: s.usageType.replace(/([A-Z])/g, ' $1').trim(),
        quantity: s.totalQuantity,
        records: s.recordCount,
      })),
    [summaries],
  );

  const columns = useMemo(
    () => [
      col.accessor('recordedAt', {
        header: () => t('billing.usage.columns.time'),
        cell: (info) => format(new Date(info.getValue()), 'MMM d, HH:mm:ss'),
      }),
      col.accessor('usageType', {
        header: () => t('billing.usage.columns.type'),
        cell: (info) => info.getValue(),
      }),
      col.accessor('quantity', {
        header: () => t('billing.usage.columns.quantity'),
        cell: (info) => formatNumber(info.getValue()),
      }),
      col.accessor('unit', {
        header: () => t('billing.usage.columns.unit'),
        cell: (info) => info.getValue(),
      }),
      col.accessor('channel', {
        header: () => t('billing.usage.columns.channel'),
        cell: (info) => info.getValue() ?? '—',
      }),
      col.accessor('referenceId', {
        header: () => t('billing.usage.columns.reference'),
        cell: (info) =>
          info.getValue() ? (
            <span className="font-mono text-xs">{info.getValue()!.slice(0, 12)}...</span>
          ) : (
            '—'
          ),
      }),
    ],
    [t, formatNumber],
  );

  if (!tenantId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground" data-testid="no-tenant-message">
          <Trans i18nKey="billing.select_tenant_usage_prefix" ns="admin" />
          <a href="/admin/tenants" className="text-brand underline">{t('billing.tenants_link')}</a>
          <Trans i18nKey="billing.select_tenant_usage_suffix" ns="admin" />
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="usage-page">
      <PageHeader title={t('billing.usage.title')} description={t('billing.usage.description')} />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4" data-testid="usage-filters">
        <div className="space-y-1.5">
          <Label htmlFor="usage-from">{t('billing.usage.filters_from')}</Label>
          <Input
            id="usage-from"
            type="datetime-local"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setDetailPage(1); }}
            className="w-52"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="usage-until">{t('billing.usage.filters_until')}</Label>
          <Input
            id="usage-until"
            type="datetime-local"
            value={until}
            onChange={(e) => { setUntil(e.target.value); setDetailPage(1); }}
            className="w-52"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('billing.usage.type')}</Label>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v ?? 'all'); setDetailPage(1); }}>
            <SelectTrigger className="w-48" data-testid="usage-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('billing.usage.all_types')}</SelectItem>
              {USAGE_TYPES.map((ut) => (
                <SelectItem key={ut} value={ut}>{ut}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Chart */}
      {summaries.length > 0 && (
        <div className="rounded-md border bg-card p-4" data-testid="usage-chart">
          <h3 className="mb-3 text-sm font-medium">{t('billing.usage.by_type')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="quantity" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Cards */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="usage-summary-cards">
          {summaries.map((s) => (
            <div key={s.usageType} className="rounded-md border bg-card p-3">
              <p className="text-xs text-muted-foreground">{s.usageType}</p>
              <p className="text-lg font-semibold">{formatNumber(s.totalQuantity)}</p>
              <p className="text-xs text-muted-foreground">{t('billing.usage.records_count', { count: s.recordCount })}</p>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Records */}
      <div data-testid="usage-records-section">
        <h3 className="mb-3 text-sm font-medium">{t('billing.usage.detailed_records')}</h3>
        <DataTable
          data={records}
          columns={columns}
          searchPlaceholder={t('billing.usage.search_placeholder')}
        />
      </div>
    </div>
  );
}
