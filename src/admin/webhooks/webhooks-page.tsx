import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus, Pencil, Eye, Trash2 } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { WebhookForm } from './webhook-form';
import { WebhookDetailSheet } from './webhook-detail-sheet';
import {
  useWebhookSubscriptions,
  useDeleteWebhookSubscription,
  type WebhookSubscription,
} from '@/core/api/hooks/use-webhooks';

const col = createColumnHelper<WebhookSubscription>();

export default function WebhooksPage() {
  const { t } = useTranslation(['admin']);
  const { data: subscriptions = [] } = useWebhookSubscriptions();
  const deleteSubscription = useDeleteWebhookSubscription();

  const [createOpen, setCreateOpen] = useState(false);
  const [editSub, setEditSub] = useState<WebhookSubscription | null>(null);
  const [detailSub, setDetailSub] = useState<WebhookSubscription | null>(null);
  const [deleteSub, setDeleteSub] = useState<WebhookSubscription | null>(null);

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: () => t('admin:webhooks.columns.name', 'Name'),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      col.accessor('endpointUrl', {
        header: () => t('admin:webhooks.columns.endpointUrl', 'Endpoint URL'),
        cell: (info) => {
          const url = info.getValue();
          const truncated = url.length > 40 ? url.slice(0, 40) + '...' : url;
          return (
            <span className="text-muted-foreground" title={url}>
              {truncated}
            </span>
          );
        },
      }),
      col.accessor('eventTypes', {
        header: () => t('admin:webhooks.columns.eventTypes', 'Event Types'),
        cell: (info) => {
          const count = info.getValue().length;
          return (
            <Badge variant="secondary">
              {count} {count === 1 ? 'event' : 'events'}
            </Badge>
          );
        },
      }),
      col.accessor('isActive', {
        header: () => t('admin:webhooks.columns.status', 'Status'),
        cell: (info) =>
          info.getValue() ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {t('admin:webhooks.status.active', 'Active')}
            </Badge>
          ) : (
            <Badge variant="secondary">
              {t('admin:webhooks.status.inactive', 'Inactive')}
            </Badge>
          ),
      }),
      col.accessor('createdAt', {
        header: () => t('admin:webhooks.columns.created', 'Created'),
        cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              data-testid={`edit-webhook-${row.original.subscriptionId}`}
              onClick={(e) => {
                e.stopPropagation();
                setEditSub(row.original);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              data-testid={`detail-webhook-${row.original.subscriptionId}`}
              onClick={(e) => {
                e.stopPropagation();
                setDetailSub(row.original);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              data-testid={`delete-webhook-${row.original.subscriptionId}`}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteSub(row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [t],
  );

  return (
    <div className="space-y-6" data-testid="webhooks-page">
      <PageHeader
        title={t('admin:webhooks.title', 'Webhook Subscriptions')}
        description={t('admin:webhooks.description', 'Manage outbound webhook subscriptions for event delivery.')}
      >
        <Button onClick={() => setCreateOpen(true)} data-testid="webhooks-create-btn">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:webhooks.create', 'New Subscription')}
        </Button>
      </PageHeader>

      <DataTable
        data={subscriptions}
        columns={columns}
        searchPlaceholder={t('admin:webhooks.searchPlaceholder', 'Search subscriptions...')}
      />

      <WebhookForm
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <WebhookForm
        open={!!editSub}
        onOpenChange={(open) => { if (!open) setEditSub(null); }}
        subscription={editSub}
      />

      <WebhookDetailSheet
        subscription={detailSub}
        open={!!detailSub}
        onOpenChange={(open) => { if (!open) setDetailSub(null); }}
      />

      <ConfirmDeleteDialog
        open={!!deleteSub}
        onOpenChange={(open) => { if (!open) setDeleteSub(null); }}
        onConfirm={() => {
          if (deleteSub) deleteSubscription.mutate(deleteSub.subscriptionId);
          setDeleteSub(null);
        }}
        entityName={deleteSub?.name ?? ''}
        entityType="webhook subscription"
        isPending={deleteSubscription.isPending}
      />
    </div>
  );
}
