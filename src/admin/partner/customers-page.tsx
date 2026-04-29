import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus, Eye, Pause, Play, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui/dialog';
import {
  usePartnerCustomers,
  useCreatePartnerCustomer,
  useUpdatePartnerCustomer,
  useActivateCustomer,
  PARTNER_PLAN_OPTIONS,
  PARTNER_TEMPLATE_OPTIONS,
  type PartnerCustomer,
} from '@/core/api/hooks/use-partner';

const col = createColumnHelper<PartnerCustomer>();

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Active: 'default',
  Suspended: 'destructive',
  Warning: 'outline',
  Degraded: 'outline',
  Deleted: 'destructive',
  PendingDeletion: 'destructive',
};

const PLAN_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  Enterprise: 'default',
  Pro: 'secondary',
  Starter: 'outline',
};

export default function PartnerCustomersPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { data: customers = [] } = usePartnerCustomers();
  const createCustomer = useCreatePartnerCustomer();
  const updateCustomer = useUpdatePartnerCustomer();
  const activateCustomer = useActivateCustomer();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerCustomer | undefined>();

  // Create form state
  const [formTenantId, setFormTenantId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPlan, setFormPlan] = useState<string>('Starter');
  const [formTemplate, setFormTemplate] = useState<string>('none');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editMaxChannels, setEditMaxChannels] = useState<string>('');
  const [editMaxCampaigns, setEditMaxCampaigns] = useState<string>('');

  function openEdit(c: PartnerCustomer) {
    setEditing(c);
    setEditName(c.name);
    setEditMaxChannels('');
    setEditMaxCampaigns('');
  }

  function handleCreate() {
    if (!formTenantId.trim() || !formName.trim()) return;
    createCustomer.mutate(
      {
        tenantId: formTenantId.trim(),
        name: formName.trim(),
        plan: formPlan,
        template: formTemplate === 'none' ? undefined : formTemplate,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setFormTenantId('');
          setFormName('');
          setFormPlan('Starter');
          setFormTemplate('none');
        },
      },
    );
  }

  function handleEdit() {
    if (!editing) return;
    updateCustomer.mutate(
      {
        id: editing.tenantId,
        name: editName.trim() || undefined,
        maxConcurrentChannels: editMaxChannels ? Number(editMaxChannels) : undefined,
        maxActiveCampaigns: editMaxCampaigns ? Number(editMaxCampaigns) : undefined,
      },
      {
        onSuccess: () => setEditing(undefined),
      },
    );
  }

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: () => t('partner.customers.columns.name'),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      col.accessor('tenantId', {
        header: () => t('partner.customers.columns.tenant_id'),
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      col.accessor('status', {
        header: () => t('partner.customers.columns.status'),
        cell: (info) => (
          <Badge
            variant={STATUS_VARIANT[info.getValue()] ?? 'outline'}
            data-status={info.getValue()}
          >
            {info.getValue()}
          </Badge>
        ),
      }),
      col.accessor('plan', {
        header: () => t('partner.customers.columns.plan'),
        cell: (info) => (
          <Badge variant={PLAN_VARIANT[info.getValue()] ?? 'outline'}>
            {info.getValue()}
          </Badge>
        ),
      }),
      col.accessor('createdAt', {
        header: () => t('partner.customers.columns.created'),
        cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => {
          const c = row.original;
          const isSuspended = c.status === 'Suspended';
          return (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid={`view-customer-${c.tenantId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/partner/customers/${c.tenantId}`);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid={`edit-customer-${c.tenantId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(c);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {isSuspended ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                  data-testid={`activate-customer-${c.tenantId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    activateCustomer.mutate(c.tenantId);
                  }}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700"
                  data-testid={`suspend-customer-${c.tenantId}`}
                  onClick={(e) => {
                    // Suspend now requires a reason — route to detail page
                    // where the ConfirmDialog enforces word-gate + reason
                    // (R5.3 Phase B B.3 / S4.3).
                    e.stopPropagation();
                    navigate(`/admin/partner/customers/${c.tenantId}`);
                  }}
                >
                  <Pause className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [navigate, activateCustomer, t],
  );

  return (
    <div className="space-y-6" data-testid="partner-customers-page">
      <PageHeader title={t('partner.customers.title')} description={t('partner.customers.description')}>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-customer">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('partner.customers.add')}
        </Button>
      </PageHeader>

      <DataTable data={customers} columns={columns} searchPlaceholder={t('partner.customers.search_placeholder')} />

      {/* Create Customer Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('partner.customers.create_dialog.title')}</DialogTitle>
            <DialogDescription>{t('partner.customers.create_dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="cust-tid">{t('partner.customers.create_dialog.tenant_id')}</Label>
              <Input
                id="cust-tid"
                data-testid="customer-tenant-id"
                value={formTenantId}
                onChange={(e) => setFormTenantId(e.target.value)}
                placeholder={t('partner.customers.create_dialog.tenant_id_placeholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">{t('partner.customers.create_dialog.display_name')}</Label>
              <Input
                id="cust-name"
                data-testid="customer-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('partner.customers.create_dialog.display_name_placeholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('partner.customers.create_dialog.plan')}</Label>
              <Select value={formPlan} onValueChange={(v) => setFormPlan(v ?? 'Starter')}>
                <SelectTrigger data-testid="customer-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTNER_PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('partner.customers.create_dialog.template')}</Label>
              <Select value={formTemplate} onValueChange={(v) => setFormTemplate(v ?? 'none')}>
                <SelectTrigger data-testid="customer-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('partner.customers.create_dialog.template_none')}</SelectItem>
                  {PARTNER_TEMPLATE_OPTIONS.map((tmpl) => (
                    <SelectItem key={tmpl} value={tmpl}>{tmpl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('partner.customers.create_dialog.cancel')}</Button>
            <Button
              onClick={handleCreate}
              disabled={!formTenantId.trim() || !formName.trim() || createCustomer.isPending}
              data-testid="customer-submit"
            >
              {createCustomer.isPending ? t('partner.customers.create_dialog.creating') : t('partner.customers.create_dialog.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Sheet */}
      <Sheet open={!!editing} onOpenChange={(open) => { if (!open) setEditing(undefined); }}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('partner.customers.edit_sheet.title')}</SheetTitle>
            <SheetDescription>{t('partner.customers.edit_sheet.description')}</SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="space-y-3 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">{t('partner.customers.edit_sheet.name')}</Label>
                <Input
                  id="edit-name"
                  data-testid="edit-customer-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-channels">{t('partner.customers.edit_sheet.max_channels')}</Label>
                <Input
                  id="edit-channels"
                  type="number"
                  min={1}
                  data-testid="edit-customer-max-channels"
                  value={editMaxChannels}
                  onChange={(e) => setEditMaxChannels(e.target.value)}
                  placeholder={t('partner.customers.edit_sheet.keep_current_placeholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-campaigns">{t('partner.customers.edit_sheet.max_campaigns')}</Label>
                <Input
                  id="edit-campaigns"
                  type="number"
                  min={0}
                  data-testid="edit-customer-max-campaigns"
                  value={editMaxCampaigns}
                  onChange={(e) => setEditMaxCampaigns(e.target.value)}
                  placeholder={t('partner.customers.edit_sheet.keep_current_placeholder')}
                />
              </div>
            </div>
          )}
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setEditing(undefined)}>{t('partner.customers.edit_sheet.cancel')}</Button>
            <Button
              onClick={handleEdit}
              disabled={updateCustomer.isPending}
              data-testid="edit-customer-submit"
            >
              {updateCustomer.isPending ? t('partner.customers.edit_sheet.saving') : t('partner.customers.edit_sheet.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
