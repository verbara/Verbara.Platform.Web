import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ArrowLeft, Pause, Play, Pencil, FileText } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
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
import { toast } from 'sonner';
import {
  usePartnerCustomer,
  useUpdatePartnerCustomer,
  useSuspendCustomer,
  useActivateCustomer,
  useCustomerSettings,
  useUpdateCustomerSettings,
  useCustomerInvoices,
  useGeneratePartnerInvoice,
  useCustomerUsage,
} from '@/core/api/hooks/use-partner';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Active: 'default',
  Suspended: 'destructive',
  Warning: 'outline',
  Degraded: 'outline',
};

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function PartnerCustomerDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('admin');
  const { data: customer } = usePartnerCustomer(id);
  const updateCustomer = useUpdatePartnerCustomer();
  const suspendCustomer = useSuspendCustomer();
  const activateCustomer = useActivateCustomer();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMaxChannels, setEditMaxChannels] = useState('');
  const [editMaxCampaigns, setEditMaxCampaigns] = useState('');

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendWord, setSuspendWord] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  function openSuspend() {
    setSuspendWord('');
    setSuspendReason('');
    setSuspendOpen(true);
  }

  function handleSuspendConfirm() {
    if (!customer) return;
    if (suspendWord !== customer.name) return;
    const reason = suspendReason.trim();
    if (!reason) {
      toast.error(
        t('partner.suspend.reasonRequired', 'Reason is required to suspend a customer.'),
      );
      return;
    }
    suspendCustomer.mutate({ id, reason });
    setSuspendOpen(false);
  }

  function openEdit() {
    if (!customer) return;
    setEditName(customer.name);
    setEditMaxChannels('');
    setEditMaxCampaigns('');
    setEditOpen(true);
  }

  function handleEdit() {
    updateCustomer.mutate(
      {
        id,
        name: editName.trim() || undefined,
        maxConcurrentChannels: editMaxChannels ? Number(editMaxChannels) : undefined,
        maxActiveCampaigns: editMaxCampaigns ? Number(editMaxCampaigns) : undefined,
      },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  if (!customer) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading customer...</p>
      </div>
    );
  }

  const isSuspended = customer.status === 'Suspended';

  return (
    <div className="space-y-6" data-testid="partner-customer-detail">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin/partner/customers')}
        data-testid="back-to-customers"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to customers
      </Button>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{customer.tenantId}</span>
        <Badge variant={STATUS_VARIANT[customer.status] ?? 'outline'} data-status={customer.status}>
          {customer.status}
        </Badge>
        <Badge variant="outline">{customer.plan}</Badge>
      </div>

      <PageHeader title={customer.name}>
        <Button variant="outline" onClick={openEdit} data-testid="edit-customer">
          <Pencil className="mr-1.5 h-4 w-4" />
          Edit
        </Button>
        {isSuspended ? (
          <Button
            variant="outline"
            className="text-green-600"
            onClick={() => activateCustomer.mutate(id)}
            data-testid="activate-customer"
          >
            <Play className="mr-1.5 h-4 w-4" />
            Activate
          </Button>
        ) : (
          <Button
            variant="outline"
            className="text-amber-600"
            onClick={openSuspend}
            data-testid="suspend-customer"
          >
            <Pause className="mr-1.5 h-4 w-4" />
            Suspend
          </Button>
        )}
      </PageHeader>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-md" data-testid="suspend-confirm-dialog">
          <DialogHeader>
            <DialogTitle>
              {t('partner.suspend.title', 'Suspend customer?')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'partner.suspend.body',
                'Suspending this customer will block their access until reactivated. This action is reversible but will interrupt service.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="suspend-confirm-word" className="text-xs">
                {t('partner.suspend.wordLabel', 'Type the customer name to confirm')}{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {customer.name}
                </code>
              </Label>
              <Input
                id="suspend-confirm-word"
                data-testid="suspend-confirm-word"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={suspendWord}
                onChange={(e) => setSuspendWord(e.target.value)}
                aria-invalid={suspendWord.length > 0 && suspendWord !== customer.name}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suspend-confirm-reason" className="text-xs">
                {t('partner.suspend.reasonLabel', 'Reason (required)')}
              </Label>
              <Textarea
                id="suspend-confirm-reason"
                data-testid="suspend-confirm-reason"
                rows={3}
                placeholder={t(
                  'partner.suspend.reasonPlaceholder',
                  'e.g. Non-payment 30 days overdue',
                )}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendOpen(false)}
              data-testid="suspend-confirm-cancel"
            >
              {t('partner.suspend.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              data-testid="suspend-confirm-submit"
              onClick={handleSuspendConfirm}
              disabled={
                suspendCustomer.isPending ||
                suspendWord !== customer.name ||
                suspendReason.trim().length === 0
              }
            >
              {suspendCustomer.isPending
                ? t('partner.suspend.submitting', 'Suspending...')
                : t('partner.suspend.confirm', 'Suspend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <InfoRow label="Tenant ID" value={customer.tenantId} mono />
            <InfoRow label="Display name" value={customer.name} />
            <InfoRow label="Plan" value={customer.plan} />
            <InfoRow label="Status" value={customer.status} />
            <InfoRow label="Created" value={format(new Date(customer.createdAt), 'MMM d, yyyy HH:mm')} />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <CustomerSettingsTab customerId={id} />
        </TabsContent>

        <TabsContent value="invoices" className="pt-4">
          <CustomerInvoicesTab customerId={id} />
        </TabsContent>

        <TabsContent value="usage" className="pt-4">
          <CustomerUsageTab customerId={id} />
        </TabsContent>
      </Tabs>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit customer</SheetTitle>
            <SheetDescription>Update customer settings and quotas.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="cd-name">Name</Label>
              <Input id="cd-name" data-testid="cd-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-channels">Max concurrent channels</Label>
              <Input
                id="cd-channels"
                type="number"
                min={1}
                data-testid="cd-edit-max-channels"
                value={editMaxChannels}
                onChange={(e) => setEditMaxChannels(e.target.value)}
                placeholder="Leave empty to keep current"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-campaigns">Max active campaigns</Label>
              <Input
                id="cd-campaigns"
                type="number"
                min={0}
                data-testid="cd-edit-max-campaigns"
                value={editMaxCampaigns}
                onChange={(e) => setEditMaxCampaigns(e.target.value)}
                placeholder="Leave empty to keep current"
              />
            </div>
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateCustomer.isPending} data-testid="cd-edit-submit">
              {updateCustomer.isPending ? 'Saving...' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function CustomerSettingsTab({ customerId }: Readonly<{ customerId: string }>) {
  const { data: settings, isLoading } = useCustomerSettings(customerId);
  const update = useUpdateCustomerSettings();
  const [editOpen, setEditOpen] = useState(false);
  const [platformName, setPlatformName] = useState('');
  const [defaultTimezone, setDefaultTimezone] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');

  function openEdit() {
    setPlatformName(settings?.platformName ?? '');
    setDefaultTimezone(settings?.defaultTimezone ?? '');
    setDefaultLanguage(settings?.defaultLanguage ?? '');
    setEditOpen(true);
  }

  function handleSave() {
    update.mutate(
      {
        id: customerId,
        platformName: platformName || undefined,
        defaultTimezone: defaultTimezone || undefined,
        defaultLanguage: defaultLanguage || undefined,
      },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading settings...</p>;

  return (
    <div className="space-y-4 max-w-2xl" data-testid="customer-settings-tab">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={openEdit} data-testid="edit-customer-settings">
          <Pencil className="mr-1.5 h-4 w-4" />
          Edit settings
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoRow label="Platform name" value={settings?.platformName ?? '—'} />
        <InfoRow label="Default timezone" value={settings?.defaultTimezone ?? '—'} />
        <InfoRow label="Default language" value={settings?.defaultLanguage ?? '—'} />
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit settings</SheetTitle>
            <SheetDescription>Update operational settings for this customer.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="cs-name">Platform name</Label>
              <Input id="cs-name" data-testid="cs-platform-name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-tz">Default timezone</Label>
              <Input id="cs-tz" data-testid="cs-timezone" value={defaultTimezone} onChange={(e) => setDefaultTimezone(e.target.value)} placeholder="America/Bogota" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-lang">Default language</Label>
              <Input id="cs-lang" data-testid="cs-language" value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} placeholder="es-CO" />
            </div>
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={update.isPending} data-testid="cs-submit">
              {update.isPending ? 'Saving...' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CustomerInvoicesTab({ customerId }: Readonly<{ customerId: string }>) {
  const { data: invoices = [] } = useCustomerInvoices(customerId);
  const generate = useGeneratePartnerInvoice(customerId);
  const [genOpen, setGenOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [margin, setMargin] = useState<{ gross: number; cost: number; margin: number; currency: string } | null>(null);

  function handleGenerate() {
    if (!from || !to) return;
    generate.mutate(
      { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
      {
        onSuccess: (resp) => {
          setGenOpen(false);
          setFrom('');
          setTo('');
          setMargin({
            gross: resp.revenue.grossAmount,
            cost: resp.revenue.platformCost,
            margin: resp.revenue.partnerMargin,
            currency: resp.invoice.currency,
          });
        },
      },
    );
  }

  return (
    <div className="space-y-4" data-testid="customer-invoices-tab">
      <div className="flex justify-end">
        <Button onClick={() => setGenOpen(true)} data-testid="generate-customer-invoice">
          <FileText className="mr-1.5 h-4 w-4" />
          Generate invoice
        </Button>
      </div>

      {margin && (
        <div className="rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950" data-testid="last-invoice-margin">
          <p className="text-sm font-medium text-green-900 dark:text-green-100">Latest invoice generated</p>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Gross</p><p className="font-medium">{formatCurrency(margin.gross, margin.currency)}</p></div>
            <div><p className="text-xs text-muted-foreground">Platform cost</p><p className="font-medium">{formatCurrency(margin.cost, margin.currency)}</p></div>
            <div><p className="text-xs text-muted-foreground">Your margin</p><p className="font-semibold text-green-700 dark:text-green-300">{formatCurrency(margin.margin, margin.currency)}</p></div>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet. Generate one to bill this customer.</p>
      ) : (
        <div className="space-y-1">
          {invoices.map((inv) => (
            <div key={inv.invoiceId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm" data-testid={`invoice-row-${inv.invoiceId}`}>
              <div>
                <p className="font-mono text-xs">{inv.invoiceId.slice(0, 8)}...</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(inv.periodStart), 'MMM d')} — {format(new Date(inv.periodEnd), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{inv.status}</Badge>
                <span className="font-medium">{formatCurrency(inv.total, inv.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate invoice</DialogTitle>
            <DialogDescription>Select the billing period to invoice this customer.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="gen-from">From</Label>
              <Input id="gen-from" type="datetime-local" data-testid="gen-from" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-to">To</Label>
              <Input id="gen-to" type="datetime-local" data-testid="gen-to" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={!from || !to || generate.isPending} data-testid="gen-submit">
              {generate.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerUsageTab({ customerId }: Readonly<{ customerId: string }>) {
  const { data: usage = [] } = useCustomerUsage(customerId);

  if (usage.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="customer-usage-empty">No usage recorded yet.</p>;
  }

  return (
    <div className="space-y-3" data-testid="customer-usage-tab">
      {usage.map((u) => (
        <div key={u.usageType} className="rounded-md border p-3" data-testid={`usage-${u.usageType}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{u.usageType}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(u.periodStart), 'MMM d')} — {format(new Date(u.periodEnd), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{u.totalQuantity.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{u.recordCount} records</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
