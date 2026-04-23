import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { StatusBadge } from '@/core/ui/status-badge';
import {
  useWebhookDeadLetter,
  useRetryDeadLetter,
  type WebhookDelivery,
} from '@/core/api/hooks/use-webhooks';
import { WebhookDeliveryDetailDrawer } from './webhook-delivery-detail-drawer';

const col = createColumnHelper<WebhookDelivery>();

export default function DeadLetterPage() {
  const { t } = useTranslation(['admin']);

  const [tenantId, setTenantId] = useState('');
  const [searchTenantId, setSearchTenantId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const pageSize = 20;

  const { data, isFetching } = useWebhookDeadLetter(searchTenantId, page, pageSize);
  const retryDeadLetter = useRetryDeadLetter();

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function handleSearch() {
    setSearchTenantId(tenantId.trim());
    setPage(1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  const columns = useMemo(
    () => [
      col.accessor('deliveryId', {
        header: () => t('admin:deadLetter.deliveryId', 'Delivery ID'),
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue().slice(0, 12)}</span>
        ),
      }),
      col.accessor('subscriptionId', {
        header: () => t('admin:deadLetter.subscriptionId', 'Subscription ID'),
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue().slice(0, 12)}</span>
        ),
      }),
      col.accessor('eventType', {
        header: () => t('admin:deadLetter.eventType', 'Event Type'),
        cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
      }),
      col.accessor('status', {
        header: () => t('admin:deadLetter.status', 'Status'),
        cell: (info) => (
          <StatusBadge variant="webhook-delivery" status={info.getValue()} />
        ),
      }),
      col.accessor('attempts', {
        header: () => t('admin:deadLetter.attempts', 'Attempts'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.attempts} / {row.original.maxAttempts}
          </span>
        ),
      }),
      col.accessor('lastResponseCode', {
        header: () => t('admin:deadLetter.responseCode', 'Response Code'),
        cell: (info) => {
          const code = info.getValue();
          return <span className="font-mono text-sm">{code ?? '\u2014'}</span>;
        },
      }),
      col.accessor('lastError', {
        header: () => t('admin:deadLetter.lastError', 'Last Error'),
        cell: (info) => {
          const error = info.getValue();
          if (!error) return <span className="text-muted-foreground">\u2014</span>;
          const truncated = error.length > 40 ? `${error.slice(0, 40)}...` : error;
          return (
            <span className="text-sm text-destructive" title={error}>
              {truncated}
            </span>
          );
        },
      }),
      col.accessor('createdAt', {
        header: () => t('admin:deadLetter.createdAt', 'Created At'),
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(info.getValue()), 'MMM d, yyyy HH:mm')}
          </span>
        ),
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDelivery(row.original);
              }}
              title={t('admin:deadLetter.view', 'View payload')}
              data-testid={`dead-letter-view-${row.original.deliveryId}`}
            >
              {t('admin:deadLetter.view', 'View')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={retryDeadLetter.isPending}
              onClick={(e) => {
                e.stopPropagation();
                retryDeadLetter.mutate(row.original.deliveryId);
              }}
              title={t('admin:deadLetter.retry', 'Retry delivery')}
              data-testid={`dead-letter-retry-${row.original.deliveryId}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [t, retryDeadLetter],
  );

  return (
    <div className="space-y-6" data-testid="dead-letter-page">
      <PageHeader
        title={t('admin:deadLetter.title', 'Webhook Dead Letter Queue')}
        description={t(
          'admin:deadLetter.description',
          'Review and retry failed webhook deliveries',
        )}
      />

      {/* Filter bar */}
      <div className="flex items-end gap-3">
        <div className="w-80 space-y-1.5">
          <Label htmlFor="dead-letter-tenant">
            {t('admin:deadLetter.tenantId', 'Tenant ID')}
          </Label>
          <Input
            id="dead-letter-tenant"
            placeholder={t('admin:deadLetter.tenantPlaceholder', 'Enter tenant ID...')}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="dead-letter-tenant-input"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={!tenantId.trim()}
          data-testid="dead-letter-search-btn"
        >
          <Search className="mr-1.5 h-4 w-4" />
          {t('admin:deadLetter.search', 'Search')}
        </Button>
      </div>

      {/* Empty state when no tenant searched */}
      {!searchTenantId && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t(
              'admin:deadLetter.enterTenant',
              'Enter a tenant ID to view dead-letter deliveries.',
            )}
          </p>
        </div>
      )}

      {/* Table */}
      {searchTenantId && (
        <>
          <div className={isFetching ? 'opacity-60 transition-opacity' : ''}>
            <DataTable
              data={items}
              columns={columns}
              searchPlaceholder={t(
                'admin:deadLetter.searchDeliveries',
                'Search deliveries...',
              )}
              noResultsMessage={t(
                'admin:deadLetter.noResults',
                'No dead-letter deliveries found.',
              )}
              pageSize={pageSize}
            />
          </div>

          {/* Server-side pagination */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('admin:deadLetter.pageInfo', 'Page {{page}} of {{totalPages}}', {
                  page,
                  totalPages,
                })}
                {' \u00B7 '}
                {t('admin:deadLetter.totalCount', '{{count}} deliveries', {
                  count: totalCount,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  {t('admin:deadLetter.previous', 'Previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  {t('admin:deadLetter.next', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <WebhookDeliveryDetailDrawer
        delivery={selectedDelivery}
        open={selectedDelivery !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDelivery(null);
        }}
      />
    </div>
  );
}
