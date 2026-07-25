import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Cable, Trash2, Search, Wand2, PlugZap } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import { TrunkForm } from './trunk-form';
import { TrunkConnectivityDialog } from './trunk-connectivity-dialog';
import {
  useTrunks,
  useActiveTrunks,
  useDeleteTrunk,
  useTrunkByName,
  useTestTrunkConnectivity,
  type TrunkSummary,
} from '@/core/api/hooks/use-trunks';

const columnHelper = createColumnHelper<TrunkSummary>();

export default function TrunksPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTrunk, setEditTrunk] = useState<TrunkSummary | null>(null);
  const [deletingTrunk, setDeletingTrunk] = useState<TrunkSummary | null>(null);
  const [testingTrunk, setTestingTrunk] = useState<TrunkSummary | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const deleteTrunk = useDeleteTrunk();
  const testConnectivity = useTestTrunkConnectivity();

  const handleTestConnectivity = useCallback(
    (trunk: TrunkSummary) => {
      setTestingTrunk(trunk);
      testConnectivity.reset();
      testConnectivity.mutate(trunk.id);
    },
    [testConnectivity],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchName), 300);
    return () => clearTimeout(timer);
  }, [searchName]);

  const { data: allTrunks = [], isLoading } = useTrunks();
  const { data: activeTrunks = [] } = useActiveTrunks();
  const { data: searchResult } = useTrunkByName(debouncedSearch);

  const baseTrunks = activeOnly ? activeTrunks : allTrunks;
  const trunks = debouncedSearch && searchResult ? [searchResult] : baseTrunks;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:trunks.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('displayName', {
        header: () => t('admin:trunks.displayName'),
      }),
      columnHelper.accessor('type', {
        header: () => t('admin:trunks.type'),
        cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
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
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <div className="flex items-center justify-end gap-1">
            <PermissionButton
              requires="campaigns:trunk:manage"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title={t('admin:trunks.connectivity.button')}
              aria-label={t('admin:trunks.connectivity.button')}
              data-testid={`trunk-test-${info.row.original.id}`}
              onClick={(e) => {
                e.stopPropagation();
                handleTestConnectivity(info.row.original);
              }}
            >
              <PlugZap className="h-3.5 w-3.5" />
            </PermissionButton>
            <PermissionButton
              requires="campaigns:trunk:manage"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              data-testid={`delete-trunk-${info.row.original.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setDeletingTrunk(info.row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </PermissionButton>
          </div>
        ),
      }),
    ],
    [t, handleTestConnectivity],
  );

  const isEmpty = !isLoading && trunks.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = <EmptyState icon={Cable} message="No trunks yet — Add your first trunk" />;
  } else {
    content = (
      <DataTable
        data={trunks}
        columns={columns}
        searchPlaceholder={t('admin:trunks.searchPlaceholder')}
        noResultsMessage="No matching trunks found."
        onRowClick={(trunk) => setEditTrunk(trunk)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="trunks-page">
      <PageHeader title={t('admin:trunks.title')}>
        {/* Primary path: the guided wizard orchestrates trunk + outbound route +
            DID in one flow. The flat form below stays the expert/edit path. */}
        <Button data-testid="trunks-wizard-btn" onClick={() => navigate('/admin/trunks/new')}>
          <Wand2 className="mr-1.5 h-4 w-4" />
          {t('admin:trunks.wizard.launchButton')}
        </Button>
        <Button
          variant="outline"
          data-testid="trunks-create-btn"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:trunks.create')}
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin:trunks.searchByNamePlaceholder')}
            aria-label={t('admin:trunks.searchByNamePlaceholder')}
            className="pl-9"
            value={searchName}
            data-testid="trunks-search"
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            data-testid="trunks-active-only"
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          <span>Active only</span>
        </label>
      </div>

      {content}

      {/* Create trunk sheet */}
      <TrunkForm open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      {/* Edit trunk sheet */}
      <TrunkForm
        open={editTrunk !== null}
        onOpenChange={(open) => {
          if (!open) setEditTrunk(null);
        }}
        mode="edit"
        trunk={editTrunk ?? undefined}
      />

      <ConfirmDeleteDialog
        open={deletingTrunk !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingTrunk(null);
        }}
        onConfirm={() => {
          if (!deletingTrunk) return;
          deleteTrunk.mutate(deletingTrunk.id, {
            onSuccess: () => setDeletingTrunk(null),
          });
        }}
        entityName={deletingTrunk?.name ?? ''}
        entityType={t('admin:trunks.entity_type')}
        isPending={deleteTrunk.isPending}
      />

      {/* Connectivity-test result panel — opens while a trunk is being tested. */}
      <TrunkConnectivityDialog
        trunkName={testingTrunk?.name ?? null}
        result={testConnectivity.data ?? null}
        isPending={testConnectivity.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setTestingTrunk(null);
            testConnectivity.reset();
          }
        }}
      />
    </div>
  );
}
