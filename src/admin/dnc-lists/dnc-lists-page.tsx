import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { ShieldBan, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { useDncLists, useDeleteDncList, type DncListSummary } from '@/core/api/hooks/use-dnc-lists';

const columnHelper = createColumnHelper<DncListSummary>();

export default function DncListsPage() {
  const navigate = useNavigate();
  const [deletingList, setDeletingList] = useState<DncListSummary | null>(null);
  const deleteDncList = useDeleteDncList();

  const { data, isLoading } = useDncLists();
  const lists: DncListSummary[] = data ?? [];

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => 'Name',
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('scope', {
        header: () => 'Scope',
        cell: (info) => (
          <Badge variant={info.getValue() === 'global' ? 'default' : 'secondary'}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('entryCount', {
        header: () => 'Entries',
        cell: (info) => info.getValue().toLocaleString(),
      }),
      columnHelper.accessor('createdAt', {
        header: () => 'Created',
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="campaigns:dnc:manage">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingList(info.row.original);
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
        <PageHeader title="DNC Lists" />
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const isEmpty = lists.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="DNC Lists" />

      {isEmpty ? (
        <EmptyState icon={ShieldBan} message="No DNC lists yet." />
      ) : (
        <DataTable
          data={lists}
          columns={columns}
          searchPlaceholder="Search DNC lists…"
          noResultsMessage="No matching DNC lists found."
          onRowClick={(list) => navigate(`/admin/dnc-lists/${list.id}`)}
        />
      )}

      <ConfirmDeleteDialog
        open={deletingList !== null}
        onOpenChange={(open) => { if (!open) setDeletingList(null); }}
        onConfirm={() => {
          if (!deletingList) return;
          deleteDncList.mutate(deletingList.id, {
            onSuccess: () => setDeletingList(null),
          });
        }}
        entityName={deletingList?.name ?? ''}
        entityType="DNC List"
        isPending={deleteDncList.isPending}
      />
    </div>
  );
}
