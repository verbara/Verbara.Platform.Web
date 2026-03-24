import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { Phone } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import {
  useCallerIdPools,
  type CallerIdPoolSummary,
} from '@/core/api/hooks/use-caller-id-pools';

const columnHelper = createColumnHelper<CallerIdPoolSummary>();

export default function CallerIdPoolsPage() {
  const navigate = useNavigate();
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
    </div>
  );
}
