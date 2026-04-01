import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { ShieldBan, Trash2, Plus, Pencil } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import {
  useDncLists,
  useCreateDncList,
  useUpdateDncList,
  useDeleteDncList,
  type DncListSummary,
} from '@/core/api/hooks/use-dnc-lists';

const columnHelper = createColumnHelper<DncListSummary>();

export default function DncListsPage() {
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
    <div className="space-y-6" data-testid="dnc-lists-page">
      <PageHeader title="DNC Lists">
        <PermissionGuard requires="campaigns:dnc:manage">
          <Button data-testid="dnc-lists-create-btn" size="sm" onClick={() => { setEditingList(null); setFormData({ name: '', scope: 'global' }); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create DNC List
          </Button>
        </PermissionGuard>
      </PageHeader>

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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingList ? 'Edit DNC List' : 'Create DNC List'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dnc-name">Name</Label>
              <Input
                data-testid="dnc-form-name"
                id="dnc-name"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dnc-scope">Scope</Label>
              <Select value={formData.scope} onValueChange={(v) => setFormData((f) => ({ ...f, scope: v ?? f.scope }))}>
                <SelectTrigger id="dnc-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="campaign">Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              data-testid="dnc-form-submit"
              disabled={!formData.name.trim() || createDnc.isPending || updateDnc.isPending}
              onClick={() => {
                if (editingList) {
                  updateDnc.mutate({ id: editingList.id, ...formData }, { onSuccess: () => setFormOpen(false) });
                } else {
                  createDnc.mutate(formData, { onSuccess: () => setFormOpen(false) });
                }
              }}
            >
              {createDnc.isPending || updateDnc.isPending ? 'Saving...' : editingList ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
