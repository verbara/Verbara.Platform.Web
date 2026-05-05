import { useState, useMemo, useCallback } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createColumnHelper } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Trash2, Pencil, Clock, CreditCard, Ban, CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { RetentionPolicySection } from '@/admin/gdpr/retention-policy-section';
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
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { PermissionGuard } from '@/core/auth/permission-guard';
import {
  useTenants,
  useCreateTenant,
  useUpdateTenant,
  useDeleteTenant,
  useSuspendTenant,
  useActivateTenant,
  type Tenant,
} from '@/core/api/hooks/use-tenants';

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Tenant>();

// ─── Form schema ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  tenantId: z
    .string()
    .min(1, 'admin:tenants.validation.tenantIdRequired')
    .regex(/^[a-z0-9-]+$/, 'admin:tenants.validation.tenantIdFormat'),
  name: z.string().min(1, 'admin:tenants.validation.nameRequired'),
  type: z.enum(['Customer', 'Partner']).optional(),
  parentTenantId: z.string().optional(),
  maxConcurrentChannels: z.coerce.number().int().min(1).optional(),
  maxActiveCampaigns: z.coerce.number().int().min(1).optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

// ─── Status badge helper ──────────────────────────────────────────────────────

interface StatusConfig {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  active: { variant: 'default' },
  warning: { variant: 'outline', className: 'text-amber-600 border-amber-300' },
  degraded: { variant: 'outline', className: 'text-orange-600 border-orange-300' },
  suspended: { variant: 'secondary' },
  pendingdeletion: { variant: 'destructive' },
  deleted: { variant: 'destructive' },
};

const STATUS_HINT: Record<string, string> = {
  warning: 'tenants.list.status_hint.warning',
  degraded: 'tenants.list.status_hint.degraded',
  pendingdeletion: 'tenants.list.status_hint.pending_deletion',
};

function canSuspend(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'active' || s === 'warning' || s === 'degraded';
}

function canActivate(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'suspended' || s === 'pendingdeletion';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    status: 'active',
    maxConcurrentChannels: 0,
    maxActiveCampaigns: 0,
  });
  const [retentionTenantId, setRetentionTenantId] = useState<string | null>(null);

  const { data: tenants = [], isLoading } = useTenants();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();
  const suspendTenant = useSuspendTenant();
  const activateTenant = useActivateTenant();

  const handleManageBilling = useCallback(
    (tenant: Tenant) => {
      useTenantStore.getState().setActiveTenant(tenant.tenantId);
      navigate('/admin/billing/rate-cards');
    },
    [navigate],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema) as Resolver<CreateFormValues>,
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
        type: values.type,
        parentTenantId: values.parentTenantId,
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
        header: () => t('tenants.list.columns.id'),
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('name', {
        header: () => t('tenants.list.columns.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: () => t('tenants.list.columns.status'),
        cell: (info) => {
          const s = info.getValue().toLowerCase();
          const config = STATUS_CONFIG[s] ?? { variant: 'outline' as const };
          const hintKey = STATUS_HINT[s];
          return (
            <div className="flex items-center gap-1.5">
              <Badge
                data-testid={`tenant-status-${info.row.original.tenantId}`}
                variant={config.variant}
                className={config.className}
              >
                {info.getValue()}
              </Badge>
              {hintKey && <span className="text-xs text-muted-foreground">{t(hintKey)}</span>}
            </div>
          );
        },
      }),
      columnHelper.accessor('type', {
        header: () => t('tenants.list.columns.type'),
        cell: (info) => (
          <Badge variant="outline" data-testid={`tenant-type-${info.row.original.tenantId}`}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('maxConcurrentChannels', {
        header: () => t('tenants.list.columns.max_channels'),
      }),
      columnHelper.accessor('maxActiveCampaigns', {
        header: () => t('tenants.list.columns.max_campaigns'),
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
                data-testid={`tenant-edit-${row.original.tenantId}`}
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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={t('tenants.list.actions.retention')}
                data-testid={`tenant-retention-${row.original.tenantId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setRetentionTenantId(row.original.tenantId);
                }}
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={t('tenants.list.actions.manage_billing')}
                data-testid={`tenant-billing-${row.original.tenantId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleManageBilling(row.original);
                }}
              >
                <CreditCard className="h-3.5 w-3.5" />
              </Button>
              {canSuspend(row.original.status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  title={t('tenants.list.actions.suspend')}
                  aria-label={t('tenants.list.actions.suspend')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSuspendTarget(row.original);
                  }}
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
              {canActivate(row.original.status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-emerald-600"
                  title={t('tenants.list.actions.activate')}
                  aria-label={t('tenants.list.actions.activate')}
                  onClick={(e) => {
                    e.stopPropagation();
                    activateTenant.mutate(row.original.tenantId);
                  }}
                >
                  <CircleCheck className="h-3.5 w-3.5" />
                </Button>
              )}
            </PermissionGuard>
            <Button
              variant="ghost"
              size="sm"
              data-testid={`tenant-delete-${row.original.tenantId}`}
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
    // handleManageBilling is now memoized via useCallback; setDeleteTarget is a
    // stable useState setter; updateTenant is the mutation hook reference.
    [t, activateTenant, handleManageBilling, setDeleteTarget],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('tenants.list.title')}>
          <Button data-testid="tenants-create-button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('tenants.list.create')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {t('tenants.list.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('tenants.list.title')}>
        <Button data-testid="tenants-create-button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('tenants.list.create')}
        </Button>
      </PageHeader>

      {tenants.length === 0 ? (
        <EmptyState icon={Building2} message={t('tenants.list.empty')} />
      ) : (
        <DataTable
          data={tenants}
          columns={columns}
          searchPlaceholder={t('tenants.list.search_placeholder')}
          noResultsMessage={t('tenants.list.no_results')}
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
        <SheetContent data-testid="tenants-create-sheet">
          <SheetHeader>
            <SheetTitle>{t('tenants.list.create_sheet.title')}</SheetTitle>
            <SheetDescription>{t('tenants.list.create_sheet.description')}</SheetDescription>
          </SheetHeader>

          <form onSubmit={onCreateSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tenantId">{t('tenants.list.create_sheet.tenant_id')}</Label>
              <Input
                id="tenantId"
                data-testid="tenants-form-tenantId"
                placeholder={t('tenants.list.create_sheet.tenant_id_placeholder')}
                aria-invalid={!!errors.tenantId}
                {...register('tenantId')}
              />
              {errors.tenantId && (
                <p className="text-xs text-destructive">{t(errors.tenantId.message ?? '')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">{t('tenants.list.create_sheet.name')}</Label>
              <Input
                id="name"
                data-testid="tenants-form-name"
                placeholder={t('tenants.list.create_sheet.name_placeholder')}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{t(errors.name.message ?? '')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">{t('tenants.list.create_sheet.type')}</Label>
              <Select
                value={watch('type') ?? 'Customer'}
                onValueChange={(v) => setValue('type', v as 'Customer' | 'Partner')}
              >
                <SelectTrigger id="type" data-testid="tenants-form-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Customer">
                    {t('tenants.list.create_sheet.type_customer')}
                  </SelectItem>
                  <SelectItem value="Partner">
                    {t('tenants.list.create_sheet.type_partner')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="parentTenantId">{t('tenants.list.create_sheet.parent_tenant')}</Label>
              <Select
                value={watch('parentTenantId') ?? ''}
                onValueChange={(v) => setValue('parentTenantId', v || undefined)}
              >
                <SelectTrigger id="parentTenantId" data-testid="tenants-form-parent">
                  <SelectValue placeholder={t('tenants.list.create_sheet.parent_none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('tenants.list.create_sheet.parent_none')}</SelectItem>
                  {tenants
                    .filter((tenant) => tenant.type === 'Platform' || tenant.type === 'Partner')
                    .map((tenant) => (
                      <SelectItem key={tenant.tenantId} value={tenant.tenantId}>
                        {tenant.name} ({tenant.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxConcurrentChannels">
                {t('tenants.list.create_sheet.max_channels')}
              </Label>
              <Input
                id="maxConcurrentChannels"
                data-testid="tenants-form-maxChannels"
                type="number"
                min={1}
                {...register('maxConcurrentChannels')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxActiveCampaigns">
                {t('tenants.list.create_sheet.max_campaigns')}
              </Label>
              <Input
                id="maxActiveCampaigns"
                data-testid="tenants-form-maxCampaigns"
                type="number"
                min={1}
                {...register('maxActiveCampaigns')}
              />
            </div>

            <SheetFooter className="pt-2">
              <Button
                type="submit"
                data-testid="tenants-form-submit"
                disabled={isSubmitting || createTenant.isPending}
                className="w-full"
              >
                {t('tenants.list.create_sheet.submit')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog (3s countdown) */}
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        entityName={deleteTarget?.name ?? ''}
        entityType={t('tenants.list.entity_type')}
      />

      {/* Suspend confirm dialog */}
      <ConfirmDialog
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSuspendTarget(null);
        }}
        title={t('tenants.list.suspend_dialog.title')}
        description={
          <>
            {t('tenants.list.suspend_dialog.description_prefix')}
            <span className="font-semibold">{suspendTarget?.name}</span>
            {t('tenants.list.suspend_dialog.description_suffix')}
          </>
        }
        confirmLabel={t('tenants.list.suspend_dialog.confirm')}
        onConfirm={() => {
          if (suspendTarget) {
            suspendTenant.mutate(suspendTarget.tenantId);
            setSuspendTarget(null);
          }
        }}
      />

      {/* Retention policy sheet */}
      {retentionTenantId && (
        <RetentionPolicySection
          tenantId={retentionTenantId}
          open={retentionTenantId !== null}
          onOpenChange={(open) => {
            if (!open) setRetentionTenantId(null);
          }}
        />
      )}

      {/* Edit tenant dialog */}
      <Dialog
        open={editingTenant !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTenant(null);
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="tenants-edit-dialog">
          <DialogHeader>
            <DialogTitle>{t('tenants.list.edit_dialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-name">{t('tenants.list.edit_dialog.name')}</Label>
              <Input
                id="edit-tenant-name"
                data-testid="tenants-edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-status">{t('tenants.list.edit_dialog.status')}</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm((f) => ({ ...f, status: v ?? f.status }))}
              >
                <SelectTrigger id="edit-tenant-status" data-testid="tenants-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    {t('tenants.list.edit_dialog.status_active')}
                  </SelectItem>
                  <SelectItem value="suspended">
                    {t('tenants.list.edit_dialog.status_suspended')}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t('tenants.list.edit_dialog.status_disabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-channels">
                {t('tenants.list.edit_dialog.max_channels')}
              </Label>
              <Input
                id="edit-tenant-channels"
                data-testid="tenants-edit-channels"
                type="number"
                min={1}
                value={editForm.maxConcurrentChannels}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, maxConcurrentChannels: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tenant-campaigns">
                {t('tenants.list.edit_dialog.max_campaigns')}
              </Label>
              <Input
                id="edit-tenant-campaigns"
                data-testid="tenants-edit-campaigns"
                type="number"
                min={1}
                value={editForm.maxActiveCampaigns}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, maxActiveCampaigns: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              data-testid="tenants-edit-cancel"
              onClick={() => setEditingTenant(null)}
            >
              {t('tenants.list.edit_dialog.cancel')}
            </Button>
            <Button
              data-testid="tenants-edit-submit"
              disabled={!editForm.name.trim() || updateTenant.isPending}
              onClick={() => {
                if (!editingTenant) return;
                updateTenant.mutate(
                  { id: editingTenant.tenantId, ...editForm },
                  {
                    onSuccess: () => setEditingTenant(null),
                  },
                );
              }}
            >
              {updateTenant.isPending
                ? t('tenants.list.edit_dialog.saving')
                : t('tenants.list.edit_dialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
