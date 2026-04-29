import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { FileText, Send, Eye, CheckCircle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
  useInvoices,
  useGenerateInvoice,
  useIssueInvoice,
  usePayInvoice,
  type Invoice,
} from '@/core/api/hooks/use-billing';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useAuthStore } from '@/core/auth/auth-store';

const col = createColumnHelper<Invoice>();

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Draft: 'secondary',
  Issued: 'default',
  Paid: 'default',
  Void: 'destructive',
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function InvoicesPage() {
  const { t } = useTranslation('admin');
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const authTenantId = useAuthStore((s) => s.tenantId);
  const tenantId = activeTenantId ?? authTenantId;
  const [page] = useState(1);
  const { data: invoices = [] } = useInvoices(page, 20);
  const generateInvoice = useGenerateInvoice();
  const issueInvoice = useIssueInvoice();
  const payInvoice = usePayInvoice();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [detailInvoice, setDetailInvoice] = useState<Invoice | undefined>();

  const columns = useMemo(
    () => [
      col.accessor('invoiceId', {
        header: () => t('billing.invoices.columns.invoice'),
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue().slice(0, 8)}...</span>
        ),
      }),
      col.accessor('periodStart', {
        header: () => t('billing.invoices.columns.period'),
        cell: (info) => {
          const inv = info.row.original;
          return `${format(new Date(inv.periodStart), 'MMM d')} — ${format(new Date(inv.periodEnd), 'MMM d, yyyy')}`;
        },
      }),
      col.accessor('total', {
        header: () => t('billing.invoices.columns.total'),
        cell: (info) => (
          <span className="font-medium">
            {formatCurrency(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      col.accessor('status', {
        header: () => t('billing.invoices.columns.status'),
        cell: (info) => (
          <Badge variant={STATUS_COLORS[info.getValue()] ?? 'outline'}>
            {info.getValue()}
          </Badge>
        ),
      }),
      col.accessor('generatedAt', {
        header: () => t('billing.invoices.columns.generated'),
        cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy HH:mm'),
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              data-testid={`view-invoice-${row.original.invoiceId}`}
              onClick={(e) => {
                e.stopPropagation();
                setDetailInvoice(row.original);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {row.original.status === 'Draft' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-brand hover:text-brand"
                data-testid={`issue-invoice-${row.original.invoiceId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  issueInvoice.mutate(row.original.invoiceId);
                }}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
            {row.original.status === 'Issued' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                data-testid={`pay-invoice-${row.original.invoiceId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  payInvoice.mutate(row.original.invoiceId);
                }}
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      }),
    ],
    [issueInvoice, payInvoice, t],
  );

  const handleGenerate = () => {
    if (!periodStart || !periodEnd) return;
    generateInvoice.mutate({
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
    });
    setGenerateOpen(false);
    setPeriodStart('');
    setPeriodEnd('');
  };

  if (!tenantId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground" data-testid="no-tenant-message">
          <Trans i18nKey="billing.select_tenant_invoices_prefix" ns="admin" />
          <a href="/admin/tenants" className="text-brand underline">{t('billing.tenants_link')}</a>
          <Trans i18nKey="billing.select_tenant_invoices_suffix" ns="admin" />
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <PageHeader title={t('billing.invoices.title')} description={t('billing.invoices.description')}>
        <Button onClick={() => setGenerateOpen(true)} data-testid="generate-invoice">
          <FileText className="mr-1.5 h-4 w-4" />
          {t('billing.invoices.generate')}
        </Button>
      </PageHeader>

      <DataTable
        data={invoices}
        columns={columns}
        searchPlaceholder={t('billing.invoices.search_placeholder')}
      />

      {/* Generate Invoice Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billing.invoices.generate_dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('billing.invoices.generate_dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="gen-start">{t('billing.invoices.generate_dialog.period_start')}</Label>
              <Input
                id="gen-start"
                type="datetime-local"
                data-testid="generate-period-start"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-end">{t('billing.invoices.generate_dialog.period_end')}</Label>
              <Input
                id="gen-end"
                type="datetime-local"
                data-testid="generate-period-end"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>{t('billing.invoices.generate_dialog.cancel')}</Button>
            <Button
              onClick={handleGenerate}
              disabled={!periodStart || !periodEnd || generateInvoice.isPending}
              data-testid="generate-invoice-submit"
            >
              {generateInvoice.isPending ? t('billing.invoices.generate_dialog.generating') : t('billing.invoices.generate_dialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!detailInvoice} onOpenChange={(open) => { if (!open) setDetailInvoice(undefined); }}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t('billing.invoices.detail.title')}</SheetTitle>
            <SheetDescription>
              {detailInvoice && `${format(new Date(detailInvoice.periodStart), 'MMM d')} — ${format(new Date(detailInvoice.periodEnd), 'MMM d, yyyy')}`}
            </SheetDescription>
          </SheetHeader>

          {detailInvoice && (
            <div className="space-y-4 px-4" data-testid="invoice-detail">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t('billing.invoices.detail.subtotal')}</p>
                  <p className="text-sm font-medium">{formatCurrency(detailInvoice.subtotal, detailInvoice.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('billing.invoices.detail.tax')}</p>
                  <p className="text-sm font-medium">{formatCurrency(detailInvoice.tax, detailInvoice.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('billing.invoices.detail.total')}</p>
                  <p className="text-sm font-semibold">{formatCurrency(detailInvoice.total, detailInvoice.currency)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={STATUS_COLORS[detailInvoice.status] ?? 'outline'}>
                  {detailInvoice.status}
                </Badge>
                {detailInvoice.paymentStatus && (
                  <Badge variant="outline" data-testid="invoice-payment-status">
                    {detailInvoice.paymentStatus}
                  </Badge>
                )}
                {detailInvoice.issuedAt && (
                  <span className="text-xs text-muted-foreground">
                    {t('billing.invoices.detail.issued_at', { date: format(new Date(detailInvoice.issuedAt), 'MMM d, yyyy') })}
                  </span>
                )}
                {detailInvoice.dueDate && (
                  <span className="text-xs text-muted-foreground" data-testid="invoice-due-date">
                    {t('billing.invoices.detail.due_date', { date: format(new Date(detailInvoice.dueDate), 'MMM d, yyyy') })}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{t('billing.invoices.detail.line_items')}</p>
                <div className="space-y-1">
                  {detailInvoice.lineItems.map((li, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      data-testid={`line-item-${idx}`}
                    >
                      <div>
                        <p className="font-medium">{li.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('billing.invoices.detail.line_summary', {
                            usageType: li.usageType,
                            quantity: li.quantity,
                            unitPrice: formatCurrency(li.unitPrice, detailInvoice.currency),
                          })}
                        </p>
                      </div>
                      <span className="font-medium">{formatCurrency(li.amount, detailInvoice.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
