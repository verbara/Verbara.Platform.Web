import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { TrendingUp, DollarSign, Users, FileText } from 'lucide-react';
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

const col = createColumnHelper<PartnerRevenueDetail>();

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function marginColor(pct: number): string {
  if (pct >= 30) return 'text-green-600 dark:text-green-400';
  if (pct >= 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export default function PartnerRevenuePage() {
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

  const columns = useMemo(
    () => [
      col.accessor('customerTenantId', {
        header: () => 'Customer',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      col.accessor('invoiceId', {
        header: () => 'Invoice',
        cell: (info) => <span className="font-mono text-xs">{info.getValue().slice(0, 8)}...</span>,
      }),
      col.accessor('grossAmount', {
        header: () => 'Gross',
        cell: (info) => <span>{formatCurrency(info.getValue())}</span>,
      }),
      col.accessor('platformCost', {
        header: () => 'Cost',
        cell: (info) => <span className="text-muted-foreground">{formatCurrency(info.getValue())}</span>,
      }),
      col.accessor('partnerMargin', {
        header: () => 'Margin',
        cell: (info) => <span className="font-medium">{formatCurrency(info.getValue())}</span>,
      }),
      col.display({
        id: 'marginPct',
        header: () => 'Margin %',
        cell: ({ row }) => {
          const r = row.original;
          const pct = r.grossAmount > 0 ? (r.partnerMargin / r.grossAmount) * 100 : 0;
          return <span className={`font-semibold ${marginColor(pct)}`} data-testid={`margin-${r.revenueId}`}>{pct.toFixed(1)}%</span>;
        },
      }),
      col.accessor('periodStart', {
        header: () => 'Period',
        cell: (info) => {
          const r = info.row.original;
          return (
            <span className="text-xs">
              {format(new Date(r.periodStart), 'MMM d')} — {format(new Date(r.periodEnd), 'MMM d, yyyy')}
            </span>
          );
        },
      }),
    ],
    [],
  );

  return (
    <div className="space-y-6" data-testid="partner-revenue-page">
      <PageHeader title="Revenue" description="Track revenue and margin across all your customers." />

      {/* Date range filter */}
      <div className="flex items-end gap-3 rounded-md border bg-muted/30 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="rev-from" className="text-xs">From</Label>
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
          <Label htmlFor="rev-until" className="text-xs">Until</Label>
          <Input
            id="rev-until"
            type="date"
            data-testid="revenue-until"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={applyFilter} data-testid="apply-revenue-filter">Apply</Button>
        {(appliedFrom || appliedUntil) && (
          <Button variant="ghost" onClick={clearFilter} data-testid="clear-revenue-filter">Clear</Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total revenue"
          value={summary ? formatCurrency(summary.totalGross) : '—'}
          testid="revenue-total-gross"
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Platform cost"
          value={summary ? formatCurrency(summary.totalPlatformCost) : '—'}
          muted
          testid="revenue-total-cost"
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Your margin"
          value={summary ? formatCurrency(summary.totalMargin) : '—'}
          highlight
          testid="revenue-total-margin"
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Customers / invoices"
          value={summary ? `${summary.customerCount} / ${summary.invoiceCount}` : '—'}
          testid="revenue-counts"
          subIcon={<FileText className="h-3 w-3 inline ml-1" />}
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Revenue details</h3>
        {details.length === 0 ? (
          <p className="rounded-md border p-6 text-center text-sm text-muted-foreground" data-testid="revenue-empty">
            No revenue records for the selected period.
          </p>
        ) : (
          <DataTable data={details} columns={columns} searchPlaceholder="Search by customer or invoice..." />
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
