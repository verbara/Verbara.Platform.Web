import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Building2, Trash2 } from 'lucide-react';
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
  useTenants,
  useCreateTenant,
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

  const { data: tenants = [], isLoading } = useTenants();
  const createTenant = useCreateTenant();
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
          <div className="flex justify-end">
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
    </div>
  );
}
