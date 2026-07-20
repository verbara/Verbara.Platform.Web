import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, PhoneIncoming, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import { useFormatPhone } from '@/core/i18n/use-format-phone';
import { DidRouteForm } from './did-route-form';
import {
  useDidRoutes,
  useDeleteDidRoute,
  type DidRouteSummary,
} from '@/core/api/hooks/use-did-routes';
import { useQueues } from '@/core/api/hooks/use-queues';

const columnHelper = createColumnHelper<DidRouteSummary>();

export default function DidRoutesPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoute, setEditRoute] = useState<DidRouteSummary | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<DidRouteSummary | null>(null);
  const deleteDidRoute = useDeleteDidRoute();
  const { formatPhone } = useFormatPhone();

  const { data: didRoutes = [], isLoading } = useDidRoutes();
  const { data: queues = [] } = useQueues();

  const queueNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of queues) map.set(q.id, q.name);
    return map;
  }, [queues]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('did', {
        header: () => t('admin:didRoutes.did'),
        cell: (info) => (
          <span className="font-medium text-foreground">{formatPhone(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('queueId', {
        header: () => t('admin:didRoutes.queue'),
        cell: (info) => <span>{queueNameById.get(info.getValue()) ?? info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'isActive',
        header: () => t('admin:didRoutes.status'),
        cell: (info) => (
          <Badge variant={info.row.original.isActive ? 'default' : 'destructive'}>
            {info.row.original.isActive ? 'active' : 'inactive'}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionButton
            requires="system:integration:manage"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            data-testid={`delete-did-route-${info.row.original.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingRoute(info.row.original);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PermissionButton>
        ),
      }),
    ],
    [t, formatPhone, queueNameById],
  );

  const isEmpty = !isLoading && didRoutes.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = <EmptyState icon={PhoneIncoming} message={t('admin:didRoutes.empty')} />;
  } else {
    content = (
      <DataTable
        data={didRoutes}
        columns={columns}
        searchPlaceholder={t('admin:didRoutes.searchPlaceholder')}
        noResultsMessage={t('admin:didRoutes.noResults')}
        onRowClick={(route) => setEditRoute(route)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="did-routes-page">
      <PageHeader title={t('admin:didRoutes.title')}>
        <Button data-testid="did-routes-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:didRoutes.create')}
        </Button>
      </PageHeader>

      {content}

      {/* Create DID route sheet */}
      <DidRouteForm open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      {/* Edit DID route sheet */}
      <DidRouteForm
        open={editRoute !== null}
        onOpenChange={(open) => {
          if (!open) setEditRoute(null);
        }}
        mode="edit"
        didRoute={editRoute ?? undefined}
      />

      <ConfirmDeleteDialog
        open={deletingRoute !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRoute(null);
        }}
        onConfirm={() => {
          if (!deletingRoute) return;
          deleteDidRoute.mutate(deletingRoute.id, {
            onSuccess: () => setDeletingRoute(null),
          });
        }}
        entityName={deletingRoute?.did ?? ''}
        entityType={t('admin:didRoutes.entity_type')}
        isPending={deleteDidRoute.isPending}
      />
    </div>
  );
}
