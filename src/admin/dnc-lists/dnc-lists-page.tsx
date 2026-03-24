import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { ShieldBan } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { useDncLists, type DncListSummary } from '@/core/api/hooks/use-dnc-lists';

const columnHelper = createColumnHelper<DncListSummary>();

export default function DncListsPage() {
  const navigate = useNavigate();

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
    </div>
  );
}
