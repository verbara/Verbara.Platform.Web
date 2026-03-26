import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Cable } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { TrunkForm } from './trunk-form';
import { useTrunks, useActiveTrunks, type TrunkSummary } from '@/core/api/hooks/use-trunks';

const columnHelper = createColumnHelper<TrunkSummary>();

export default function TrunksPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTrunk, setEditTrunk] = useState<TrunkSummary | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);

  const { data: allTrunks = [], isLoading } = useTrunks();
  const { data: activeTrunks = [] } = useActiveTrunks();

  const trunks = activeOnly ? activeTrunks : allTrunks;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:trunks.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('displayName', {
        header: () => t('admin:trunks.displayName'),
      }),
      columnHelper.accessor('type', {
        header: () => t('admin:trunks.type'),
        cell: (info) => (
          <Badge variant="secondary">{info.getValue()}</Badge>
        ),
      }),
      columnHelper.accessor('maxChannels', {
        header: () => t('admin:trunks.maxChannels'),
      }),
      columnHelper.display({
        id: 'isActive',
        header: () => t('admin:trunks.status'),
        cell: (info) => (
          <Badge variant={info.row.original.isActive ? 'default' : 'destructive'}>
            {info.row.original.isActive ? 'active' : 'inactive'}
          </Badge>
        ),
      }),
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:trunks.title')}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:trunks.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const isEmpty = trunks.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:trunks.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:trunks.create')}
        </Button>
      </PageHeader>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
        Active only
      </label>

      {isEmpty ? (
        <EmptyState
          icon={Cable}
          message="No trunks yet — Add your first trunk"
        />
      ) : (
        <DataTable
          data={trunks}
          columns={columns}
          searchPlaceholder={t('admin:trunks.searchPlaceholder')}
          noResultsMessage="No matching trunks found."
          onRowClick={(trunk) => setEditTrunk(trunk)}
        />
      )}

      {/* Create trunk sheet */}
      <TrunkForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      {/* Edit trunk sheet */}
      <TrunkForm
        open={editTrunk !== null}
        onOpenChange={(open) => { if (!open) setEditTrunk(null); }}
        mode="edit"
        trunk={editTrunk ?? undefined}
      />
    </div>
  );
}
