import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Search, X } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { usePurgeLog, type PurgeEntry } from '@/core/api/hooks/use-gdpr';

const col = createColumnHelper<PurgeEntry>();

function formatEntitiesDeleted(entities: Record<string, number>): string {
  return Object.entries(entities)
    .filter(([, count]) => count > 0)
    .map(([entity, count]) => `${count} ${entity}`)
    .join(', ');
}

export default function PurgeLogPage() {
  const [tenantId, setTenantId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{
    tenantId?: string;
    from?: string;
    to?: string;
  }>({});

  const { data } = usePurgeLog(appliedFilters);
  const entries = data?.items ?? [];

  function applyFilters() {
    setAppliedFilters({
      tenantId: tenantId.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }

  function clearFilters() {
    setTenantId('');
    setFrom('');
    setTo('');
    setAppliedFilters({});
  }

  const hasFilters = tenantId || from || to;

  const columns = useMemo(
    () => [
      col.accessor('purgeId', {
        header: () => 'Purge ID',
        cell: (info) => (
          <span className="font-mono text-xs" title={info.getValue()}>
            {info.getValue().slice(0, 12)}
          </span>
        ),
      }),
      col.accessor('tenantId', {
        header: () => 'Tenant ID',
        cell: (info) => (
          <span className="text-sm">{info.getValue()}</span>
        ),
      }),
      col.display({
        id: 'subject',
        header: () => 'Subject',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.subjectType}: {row.original.subjectId}
          </span>
        ),
      }),
      col.accessor('performedBy', {
        header: () => 'Performed By',
        cell: (info) => (
          <span className="text-sm">{info.getValue()}</span>
        ),
      }),
      col.accessor('reason', {
        header: () => 'Reason',
        cell: (info) => {
          const value = info.getValue();
          const truncated = value.length > 50 ? `${value.slice(0, 50)}...` : value;
          return (
            <span className="text-sm text-muted-foreground" title={value}>
              {truncated}
            </span>
          );
        },
      }),
      col.accessor('entitiesDeleted', {
        header: () => 'Entities Deleted',
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {formatEntitiesDeleted(info.getValue())}
          </span>
        ),
      }),
      col.accessor('purgedAt', {
        header: () => 'Purged At',
        cell: (info) => (
          <span className="text-sm">
            {format(new Date(info.getValue()), 'MMM d, yyyy HH:mm')}
          </span>
        ),
      }),
    ],
    [],
  );

  return (
    <div className="space-y-6" data-testid="purge-log-page">
      <PageHeader
        title="Purge Log"
        description="View history of GDPR data purge operations across all tenants."
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-tenant">Tenant ID</Label>
          <Input
            id="filter-tenant"
            placeholder="Filter by tenant"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="w-48"
            data-testid="purge-log-filter-tenant"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-from">From</Label>
          <Input
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
            data-testid="purge-log-filter-from"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-to">To</Label>
          <Input
            id="filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
            data-testid="purge-log-filter-to"
          />
        </div>
        <Button onClick={applyFilters} size="sm">
          <Search className="mr-1.5 h-3.5 w-3.5" />
          Apply
        </Button>
        {hasFilters && (
          <Button onClick={clearFilters} variant="ghost" size="sm">
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <DataTable
        data={entries}
        columns={columns}
        searchPlaceholder="Search purge log..."
        noResultsMessage="No purge records found."
      />
    </div>
  );
}
