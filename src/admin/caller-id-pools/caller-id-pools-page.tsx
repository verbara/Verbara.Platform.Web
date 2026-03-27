import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { Phone, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import {
  useCallerIdPools,
  useDeletePool,
  type CallerIdPoolSummary,
} from '@/core/api/hooks/use-caller-id-pools';

const columnHelper = createColumnHelper<CallerIdPoolSummary>();

export default function CallerIdPoolsPage() {
  const navigate = useNavigate();
  const [deletingPool, setDeletingPool] = useState<CallerIdPoolSummary | null>(null);
  const deletePool = useDeletePool();
  const { data, isLoading } = useCallerIdPools();
  const pools: CallerIdPoolSummary[] = data ?? [];

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => 'Name',
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="campaigns:callerid:manage">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingPool(info.row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGuard>
        ),
      }),
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Caller ID Pools" />
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Caller ID Pools" description="Manage outbound caller ID number pools." />

      {pools.length === 0 ? (
        <EmptyState icon={Phone} message="No caller ID pools configured yet." />
      ) : (
        <DataTable
          data={pools}
          columns={columns}
          searchPlaceholder="Search pools…"
          noResultsMessage="No matching pools found."
          onRowClick={(pool) => navigate(`/admin/caller-id-pools/${pool.id}`)}
        />
      )}

      <ConfirmDeleteDialog
        open={deletingPool !== null}
        onOpenChange={(open) => { if (!open) setDeletingPool(null); }}
        onConfirm={() => {
          if (!deletingPool) return;
          deletePool.mutate(deletingPool.id, {
            onSuccess: () => setDeletingPool(null),
          });
        }}
        entityName={deletingPool?.name ?? ''}
        entityType="Caller ID Pool"
        isPending={deletePool.isPending}
      />
    </div>
  );
}
