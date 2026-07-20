import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/core/ui/page-header';
import { DataTable } from '@/core/ui/data-table';
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
  const { t } = useTranslation('admin');
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
        header: () => t('purge-log.columns.purge_id'),
        cell: (info) => (
          <span className="font-mono text-xs" title={info.getValue()}>
            {info.getValue().slice(0, 12)}
          </span>
        ),
      }),
      col.accessor('tenantId', {
        header: () => t('purge-log.columns.tenant_id'),
        cell: (info) => (
          <span className="text-sm">{info.getValue()}</span>
        ),
      }),
      col.display({
        id: 'subject',
        header: () => t('purge-log.columns.subject'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.subjectType}: {row.original.subjectId}
          </span>
        ),
      }),
      col.accessor('performedBy', {
        header: () => t('purge-log.columns.performed_by'),
        cell: (info) => (
          <span className="text-sm">{info.getValue()}</span>
        ),
      }),
      col.accessor('reason', {
        header: () => t('purge-log.columns.reason'),
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
        header: () => t('purge-log.columns.entities_deleted'),
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {formatEntitiesDeleted(info.getValue())}
          </span>
        ),
      }),
      col.accessor('purgedAt', {
        header: () => t('purge-log.columns.purged_at'),
        cell: (info) => (
          <span className="text-sm">
            {format(new Date(info.getValue()), 'MMM d, yyyy HH:mm')}
          </span>
        ),
      }),
    ],
    [t],
  );

  return (
    <div className="space-y-6" data-testid="purge-log-page">
      <PageHeader
        title={t('purge-log.title')}
        description={t('purge-log.description')}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-tenant">{t('purge-log.filter_tenant')}</Label>
          <Input
            id="filter-tenant"
            placeholder={t('purge-log.filter_tenant_placeholder')}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="w-48"
            data-testid="purge-log-filter-tenant"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-from">{t('purge-log.filter_from')}</Label>
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
          <Label htmlFor="filter-to">{t('purge-log.filter_to')}</Label>
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
          {t('purge-log.apply')}
        </Button>
        {hasFilters && (
          <Button onClick={clearFilters} variant="ghost" size="sm">
            <X className="mr-1.5 h-3.5 w-3.5" />
            {t('purge-log.clear')}
          </Button>
        )}
      </div>

      <DataTable
        data={entries}
        columns={columns}
        searchPlaceholder={t('purge-log.search_placeholder')}
        noResultsMessage={t('purge-log.no_results')}
      />
    </div>
  );
}
