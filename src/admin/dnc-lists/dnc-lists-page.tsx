import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { ShieldBan, Trash2, Plus, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { PermissionButton } from '@/core/ui/permission-button';
import {
  useDncLists,
  useCreateDncList,
  useUpdateDncList,
  useDeleteDncList,
  type DncListSummary,
} from '@/core/api/hooks/use-dnc-lists';
import { useFormatDate, useFormatNumber } from '@/core/i18n/use-format';

const columnHelper = createColumnHelper<DncListSummary>();

export default function DncListsPage() {
  const { t } = useTranslation('admin');
  const { formatDateShort } = useFormatDate();
  const { formatNumber } = useFormatNumber();
  const navigate = useNavigate();
  const [deletingList, setDeletingList] = useState<DncListSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingList, setEditingList] = useState<DncListSummary | null>(null);
  const [formData, setFormData] = useState({ name: '', scope: 'global' });
  const deleteDncList = useDeleteDncList();
  const createDnc = useCreateDncList();
  const updateDnc = useUpdateDncList();

  const { data, isLoading } = useDncLists();
  const lists: DncListSummary[] = data ?? [];

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('dnc-lists.columns.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('scope', {
        header: () => t('dnc-lists.columns.scope'),
        cell: (info) => (
          <Badge variant={info.getValue() === 'global' ? 'default' : 'secondary'}>
            {t(`dnc-lists.scope.${info.getValue()}`)}
          </Badge>
        ),
      }),
      columnHelper.accessor('entryCount', {
        header: () => t('dnc-lists.columns.entries'),
        cell: (info) => formatNumber(info.getValue()),
      }),
      columnHelper.accessor('createdAt', {
        header: () => t('dnc-lists.columns.created'),
        cell: (info) => formatDateShort(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="campaigns:dnc:manage">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  const list = info.row.original;
                  setEditingList(list);
                  setFormData({ name: list.name, scope: list.scope });
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                data-testid={`delete-dnc-${info.row.original.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingList(info.row.original);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </PermissionGuard>
        ),
      }),
    ],
    [t, formatNumber, formatDateShort],
  );

  const isEmpty = !isLoading && lists.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = <EmptyState icon={ShieldBan} message={t('dnc-lists.empty')} />;
  } else {
    content = (
      <DataTable
        data={lists}
        columns={columns}
        searchPlaceholder={t('dnc-lists.search_placeholder')}
        noResultsMessage={t('dnc-lists.no_results')}
        onRowClick={(list) => navigate(`/admin/dnc-lists/${list.id}`)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="dnc-lists-page">
      <PageHeader title={t('dnc-lists.title')}>
        <PermissionButton
          requires="campaigns:dnc:manage"
          data-testid="dnc-lists-create-btn"
          size="sm"
          onClick={() => {
            setEditingList(null);
            setFormData({ name: '', scope: 'global' });
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('dnc-lists.create')}
        </PermissionButton>
      </PageHeader>

      {content}

      <ConfirmDeleteDialog
        open={deletingList !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingList(null);
        }}
        onConfirm={() => {
          if (!deletingList) return;
          deleteDncList.mutate(deletingList.id, {
            onSuccess: () => setDeletingList(null),
          });
        }}
        entityName={deletingList?.name ?? ''}
        entityType={t('dnc-lists.entity_type')}
        isPending={deleteDncList.isPending}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingList ? t('dnc-lists.form.edit_title') : t('dnc-lists.form.create_title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dnc-name">{t('dnc-lists.form.name')}</Label>
              <Input
                data-testid="dnc-form-name"
                id="dnc-name"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dnc-scope">{t('dnc-lists.form.scope')}</Label>
              <Select
                value={formData.scope}
                onValueChange={(v) => setFormData((f) => ({ ...f, scope: v ?? f.scope }))}
              >
                <SelectTrigger id="dnc-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">{t('dnc-lists.scope.global')}</SelectItem>
                  <SelectItem value="campaign">{t('dnc-lists.scope.campaign')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t('dnc-lists.form.cancel')}
            </Button>
            <Button
              data-testid="dnc-form-submit"
              disabled={!formData.name.trim() || createDnc.isPending || updateDnc.isPending}
              onClick={() => {
                if (editingList) {
                  updateDnc.mutate(
                    { id: editingList.id, ...formData },
                    { onSuccess: () => setFormOpen(false) },
                  );
                } else {
                  createDnc.mutate(formData, { onSuccess: () => setFormOpen(false) });
                }
              }}
            >
              {createDnc.isPending || updateDnc.isPending
                ? t('dnc-lists.form.saving')
                : editingList
                  ? t('dnc-lists.form.update')
                  : t('dnc-lists.form.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
