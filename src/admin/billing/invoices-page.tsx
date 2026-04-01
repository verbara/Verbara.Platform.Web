import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { FileText, Send, Eye } from 'lucide-react';
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
  type Invoice,
} from '@/core/api/hooks/use-billing';
import { useTenantStore } from '@/core/tenant/tenant-store';

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
  const tenantId = useTenantStore((s) => s.activeTenantId);
  const [page] = useState(1);
  const { data: invoices = [] } = useInvoices(page, 20);
  const generateInvoice = useGenerateInvoice();
  const issueInvoice = useIssueInvoice();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [detailInvoice, setDetailInvoice] = useState<Invoice | undefined>();

  const columns = useMemo(
    () => [
      col.accessor('invoiceId', {
        header: () => 'Invoice',
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue().slice(0, 8)}...</span>
        ),
      }),
      col.accessor('periodStart', {
        header: () => 'Period',
        cell: (info) => {
          const inv = info.row.original;
          return `${format(new Date(inv.periodStart), 'MMM d')} — ${format(new Date(inv.periodEnd), 'MMM d, yyyy')}`;
        },
      }),
      col.accessor('total', {
        header: () => 'Total',
        cell: (info) => (
          <span className="font-medium">
            {formatCurrency(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      col.accessor('status', {
        header: () => 'Status',
        cell: (info) => (
          <Badge variant={STATUS_COLORS[info.getValue()] ?? 'outline'}>
            {info.getValue()}
          </Badge>
        ),
      }),
      col.accessor('generatedAt', {
        header: () => 'Generated',
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
          </div>
        ),
      }),
    ],
    [issueInvoice],
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
          Select a tenant from the <a href="/admin/tenants" className="text-brand underline">Tenants page</a> to manage invoices.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <PageHeader title="Invoices" description="Generate and manage billing invoices.">
        <Button onClick={() => setGenerateOpen(true)} data-testid="generate-invoice">
          <FileText className="mr-1.5 h-4 w-4" />
          Generate invoice
        </Button>
      </PageHeader>

      <DataTable
        data={invoices}
        columns={columns}
        searchPlaceholder="Search invoices..."
      />

      {/* Generate Invoice Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate invoice</DialogTitle>
            <DialogDescription>
              Select the billing period to generate an invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="gen-start">Period start</Label>
              <Input
                id="gen-start"
                type="datetime-local"
                data-testid="generate-period-start"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-end">Period end</Label>
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
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGenerate}
              disabled={!periodStart || !periodEnd || generateInvoice.isPending}
              data-testid="generate-invoice-submit"
            >
              {generateInvoice.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!detailInvoice} onOpenChange={(open) => { if (!open) setDetailInvoice(undefined); }}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Invoice detail</SheetTitle>
            <SheetDescription>
              {detailInvoice && `${format(new Date(detailInvoice.periodStart), 'MMM d')} — ${format(new Date(detailInvoice.periodEnd), 'MMM d, yyyy')}`}
            </SheetDescription>
          </SheetHeader>

          {detailInvoice && (
            <div className="space-y-4 px-4" data-testid="invoice-detail">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-sm font-medium">{formatCurrency(detailInvoice.subtotal, detailInvoice.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax</p>
                  <p className="text-sm font-medium">{formatCurrency(detailInvoice.tax, detailInvoice.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-semibold">{formatCurrency(detailInvoice.total, detailInvoice.currency)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={STATUS_COLORS[detailInvoice.status] ?? 'outline'}>
                  {detailInvoice.status}
                </Badge>
                {detailInvoice.issuedAt && (
                  <span className="text-xs text-muted-foreground">
                    Issued {format(new Date(detailInvoice.issuedAt), 'MMM d, yyyy')}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Line items</p>
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
                          {li.usageType} · {li.quantity} units @ {formatCurrency(li.unitPrice, detailInvoice.currency)}
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
