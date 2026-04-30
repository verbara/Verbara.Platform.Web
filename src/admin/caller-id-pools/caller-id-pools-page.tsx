import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { Phone, Trash2, Plus, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/ui/dialog';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import {
  useCallerIdPools,
  useCreatePool,
  useUpdatePool,
  useDeletePool,
  type CallerIdPoolSummary,
} from '@/core/api/hooks/use-caller-id-pools';

const columnHelper = createColumnHelper<CallerIdPoolSummary>();

export default function CallerIdPoolsPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [deletingPool, setDeletingPool] = useState<CallerIdPoolSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<CallerIdPoolSummary | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const deletePool = useDeletePool();
  const createPool = useCreatePool();
  const updatePool = useUpdatePool();
  const { data, isLoading } = useCallerIdPools();
  const pools: CallerIdPoolSummary[] = data ?? [];

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('caller-id-pools.columns.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="campaigns:callerid:manage">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid={`edit-pool-${info.row.original.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const pool = info.row.original;
                  setEditingPool(pool);
                  setFormData({ name: pool.name });
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                data-testid={`delete-pool-${info.row.original.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingPool(info.row.original);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </PermissionGuard>
        ),
      }),
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('caller-id-pools.title')} />
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {t('caller-id-pools.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="caller-id-pools-page">
      <PageHeader title={t('caller-id-pools.title')} description={t('caller-id-pools.description')}>
        <PermissionGuard requires="campaigns:callerid:manage">
          <Button size="sm" data-testid="caller-id-pools-create-btn" onClick={() => { setEditingPool(null); setFormData({ name: '' }); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('caller-id-pools.create')}
          </Button>
        </PermissionGuard>
      </PageHeader>

      {pools.length === 0 ? (
        <EmptyState icon={Phone} message={t('caller-id-pools.empty')} />
      ) : (
        <DataTable
          data={pools}
          columns={columns}
          searchPlaceholder={t('caller-id-pools.search_placeholder')}
          noResultsMessage={t('caller-id-pools.no_results')}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPool ? t('caller-id-pools.form.edit_title') : t('caller-id-pools.form.create_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pool-name">{t('caller-id-pools.form.name')}</Label>
              <Input
                id="pool-name"
                data-testid="pool-form-name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t('caller-id-pools.form.cancel')}</Button>
            <Button
              data-testid="pool-form-submit"
              disabled={!formData.name.trim() || createPool.isPending || updatePool.isPending}
              onClick={() => {
                if (editingPool) {
                  updatePool.mutate({ id: editingPool.id, ...formData }, { onSuccess: () => setFormOpen(false) });
                } else {
                  createPool.mutate(formData, { onSuccess: () => setFormOpen(false) });
                }
              }}
            >
              {createPool.isPending || updatePool.isPending ? t('caller-id-pools.form.saving') : editingPool ? t('caller-id-pools.form.update') : t('caller-id-pools.form.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
