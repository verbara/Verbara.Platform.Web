import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format, startOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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

const col = createColumnHelper<UsageRecord>();

export default function UsagePage() {
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
        header: () => 'Time',
        cell: (info) => format(new Date(info.getValue()), 'MMM d, HH:mm:ss'),
      }),
      col.accessor('usageType', {
        header: () => 'Type',
        cell: (info) => info.getValue(),
      }),
      col.accessor('quantity', {
        header: () => 'Quantity',
        cell: (info) => info.getValue().toLocaleString(),
      }),
      col.accessor('unit', {
        header: () => 'Unit',
        cell: (info) => info.getValue(),
      }),
      col.accessor('channel', {
        header: () => 'Channel',
        cell: (info) => info.getValue() ?? '—',
      }),
      col.accessor('referenceId', {
        header: () => 'Reference',
        cell: (info) =>
          info.getValue() ? (
            <span className="font-mono text-xs">{info.getValue()!.slice(0, 12)}...</span>
          ) : (
            '—'
          ),
      }),
    ],
    [],
  );

  if (!tenantId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground" data-testid="no-tenant-message">
          Select a tenant from the <a href="/admin/tenants" className="text-brand underline">Tenants page</a> to view usage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="usage-page">
      <PageHeader title="Usage" description="View metered usage summary and detailed records." />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4" data-testid="usage-filters">
        <div className="space-y-1.5">
          <Label htmlFor="usage-from">From</Label>
          <Input
            id="usage-from"
            type="datetime-local"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setDetailPage(1); }}
            className="w-52"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="usage-until">Until</Label>
          <Input
            id="usage-until"
            type="datetime-local"
            value={until}
            onChange={(e) => { setUntil(e.target.value); setDetailPage(1); }}
            className="w-52"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setDetailPage(1); }}>
            <SelectTrigger className="w-48" data-testid="usage-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
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
          <h3 className="mb-3 text-sm font-medium">Usage by type</h3>
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
              <p className="text-lg font-semibold">{s.totalQuantity.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{s.recordCount} records</p>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Records */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Detailed records</h3>
        <DataTable
          data={records}
          columns={columns}
          searchPlaceholder="Search records..."
        />
      </div>
    </div>
  );
}
