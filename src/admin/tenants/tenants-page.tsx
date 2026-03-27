import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Building2, Trash2, Pencil } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
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
import { PermissionGuard } from '@/core/auth/permission-guard';
import {
  useTenants,
  useCreateTenant,
  useUpdateTenant,
  useDeleteTenant,
  type Tenant,
} from '@/core/api/hooks/use-tenants';

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Tenant>();

// ─── Form schema ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required').regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, hyphens only'),
  name: z.string().min(1, 'Name is required'),
  maxConcurrentChannels: z.coerce.number().int().min(1).optional(),
  maxActiveCampaigns: z.coerce.number().int().min(1).optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

// ─── Status badge helper ──────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  suspended: 'secondary',
  deleted: 'destructive',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({ name: '', status: 'active', maxConcurrentChannels: 0, maxActiveCampaigns: 0 });

  const { data: tenants = [], isLoading } = useTenants();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema) as any,
    defaultValues: {
      tenantId: '',
      name: '',
      maxConcurrentChannels: 100,
      maxActiveCampaigns: 10,
    },
  });

  const onCreateSubmit = handleSubmit((values) => {
    createTenant.mutate(
      {
        tenantId: values.tenantId,
        name: values.name,
        maxConcurrentChannels: values.maxConcurrentChannels,
        maxActiveCampaigns: values.maxActiveCampaigns,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          reset();
        },
      },
    );
  });

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteTenant.mutate(deleteTarget.tenantId, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('tenantId', {
        header: () => 'ID',
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('name', {
        header: () => 'Name',
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('status', {
        header: () => 'Status',
        cell: (info) => {
          const s = info.getValue().toLowerCase();
          return (
            <Badge variant={STATUS_VARIANT[s] ?? 'outline'}>
              {info.getValue()}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('maxConcurrentChannels', {
        header: () => 'Max Channels',
      }),
      columnHelper.accessor('maxActiveCampaigns', {
        header: () => 'Max Campaigns',
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <PermissionGuard requires="system:tenant:configure">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  const t = row.original;
                  setEditingTenant(t);
                  setEditForm({
                    name: t.name,
                    status: t.status,
                    maxConcurrentChannels: t.maxConcurrentChannels,
                    maxActiveCampaigns: t.maxActiveCampaigns,
                  });
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </PermissionGuard>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tenants">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Tenant
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Tenant
        </Button>
      </PageHeader>

      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          message="No tenants yet — create your first tenant"
        />
      ) : (
        <DataTable
          data={tenants}
          columns={columns}
          searchPlaceholder="Search tenants…"
          noResultsMessage="No matching tenants found."
        />
      )}

      {/* Create sheet */}
      <Sheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) reset();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New Tenant</SheetTitle>
            <SheetDescription>
              Create a new tenant in the platform. The Tenant ID cannot be changed after creation.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={onCreateSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tenantId">Tenant ID</Label>
              <Input
                id="tenantId"
                placeholder="acme-corp"
                aria-invalid={!!errors.tenantId}
                {...register('tenantId')}
              />
              {errors.tenantId && (
                <p className="text-xs text-destructive">{errors.tenantId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Acme Corporation"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxConcurrentChannels">Max Concurrent Channels</Label>
              <Input
                id="maxConcurrentChannels"
                type="number"
                min={1}
                {...register('maxConcurrentChannels')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxActiveCampaigns">Max Active Campaigns</Label>
              <Input
                id="maxActiveCampaigns"
                type="number"
                min={1}
                {...register('maxActiveCampaigns')}
              />
            </div>

            <SheetFooter className="pt-2">
              <Button type="submit" disabled={isSubmitting || createTenant.isPending} className="w-full">
                Create Tenant
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Tenant"
        description={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold">{deleteTarget?.name}</span>? This action will mark the tenant as deleted.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />

      {/* Edit tenant dialog */}
      <Dialog open={editingTenant !== null} onOpenChange={(open) => { if (!open) setEditingTenant(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-name">Name</Label>
              <Input
                id="edit-tenant-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-status">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v ?? f.status }))}>
                <SelectTrigger id="edit-tenant-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-channels">Max Concurrent Channels</Label>
              <Input
                id="edit-tenant-channels"
                type="number"
                min={1}
                value={editForm.maxConcurrentChannels}
                onChange={(e) => setEditForm((f) => ({ ...f, maxConcurrentChannels: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-campaigns">Max Active Campaigns</Label>
              <Input
                id="edit-tenant-campaigns"
                type="number"
                min={1}
                value={editForm.maxActiveCampaigns}
                onChange={(e) => setEditForm((f) => ({ ...f, maxActiveCampaigns: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTenant(null)}>Cancel</Button>
            <Button
              disabled={!editForm.name.trim() || updateTenant.isPending}
              onClick={() => {
                if (!editingTenant) return;
                updateTenant.mutate({ id: editingTenant.tenantId, ...editForm }, {
                  onSuccess: () => setEditingTenant(null),
                });
              }}
            >
              {updateTenant.isPending ? 'Saving...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
