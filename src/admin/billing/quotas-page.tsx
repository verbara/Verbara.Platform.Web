import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import { Pencil, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  useQuotaStatus,
  useUpdateQuota,
  useDunningStatus,
  QUOTA_ACTIONS,
  type UpdateQuotaInput,
} from '@/core/api/hooks/use-billing';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useAuthStore } from '@/core/auth/auth-store';

const quotaSchema = z.object({
  maxConcurrentChannels: z.coerce.number().int().min(1),
  maxActiveCampaigns: z.coerce.number().int().min(1),
  maxMonthlyVoiceMinutes: z.coerce.number().int().min(0).nullable(),
  maxMonthlyMessages: z.coerce.number().int().min(0).nullable(),
  maxStorageBytes: z.coerce.number().int().min(0).nullable(),
  maxActiveAgents: z.coerce.number().int().min(0).nullable(),
  quotaAction: z.string(),
});

type QuotaFormValues = z.infer<typeof quotaSchema>;

const ACTION_ICONS: Record<string, React.ElementType> = {
  Warn: ShieldAlert,
  SoftBlock: ShieldCheck,
  HardBlock: ShieldX,
};

const ACTION_COLORS: Record<string, string> = {
  Warn: 'text-warning',
  SoftBlock: 'text-brand',
  HardBlock: 'text-destructive',
};

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

interface QuotaRowProps {
  label: string;
  limit: number | null | undefined;
  usage?: number;
  formatter?: (v: number | null | undefined) => string;
}

function QuotaRow({ label, limit, usage = 0, formatter }: QuotaRowProps) {
  const fmt = formatter ?? ((v: number | null | undefined) => v?.toLocaleString() ?? '—');
  const pct = limit && limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;
  const color = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-brand';

  return (
    <div className="space-y-1.5 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {usage.toLocaleString()} / {fmt(limit)}
        </span>
      </div>
      {limit != null && limit > 0 && (
        <div className="h-2 rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function QuotasPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const authTenantId = useAuthStore((s) => s.tenantId);
  const tenantId = activeTenantId ?? authTenantId;
  const { data: status } = useQuotaStatus();
  const { data: dunning } = useDunningStatus(tenantId ?? undefined);
  const updateQuota = useUpdateQuota();
  const [editOpen, setEditOpen] = useState(false);

  const quota = status?.quota;
  const usage = status?.currentUsage ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuotaFormValues>({
    resolver: zodResolver(quotaSchema) as any,
  });

  useEffect(() => {
    if (editOpen && quota) {
      reset({
        maxConcurrentChannels: quota.maxConcurrentChannels,
        maxActiveCampaigns: quota.maxActiveCampaigns,
        maxMonthlyVoiceMinutes: quota.maxMonthlyVoiceMinutes,
        maxMonthlyMessages: quota.maxMonthlyMessages,
        maxStorageBytes: quota.maxStorageBytes,
        maxActiveAgents: quota.maxActiveAgents,
        quotaAction: quota.quotaAction,
      });
    }
  }, [editOpen, quota, reset]);

  const onSubmit = handleSubmit((values) => {
    const data: UpdateQuotaInput = {
      maxConcurrentChannels: values.maxConcurrentChannels,
      maxActiveCampaigns: values.maxActiveCampaigns,
      maxMonthlyVoiceMinutes: values.maxMonthlyVoiceMinutes,
      maxMonthlyMessages: values.maxMonthlyMessages,
      maxStorageBytes: values.maxStorageBytes,
      maxActiveAgents: values.maxActiveAgents,
      quotaAction: values.quotaAction,
    };
    updateQuota.mutate(data);
    setEditOpen(false);
  });

  function usageFor(...types: string[]): number {
    return usage
      .filter((u) => types.some((t) => u.usageType.includes(t)))
      .reduce((sum, u) => sum + u.totalQuantity, 0);
  }

  if (!tenantId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground" data-testid="no-tenant-message">
          Select a tenant from the <a href="/admin/tenants" className="text-brand underline">Tenants page</a> to manage quotas.
        </p>
      </div>
    );
  }

  const ActionIcon = quota ? (ACTION_ICONS[quota.quotaAction] ?? ShieldAlert) : ShieldAlert;

  return (
    <div className="space-y-6" data-testid="quotas-page">
      <PageHeader title="Quotas" description="View and configure tenant usage limits.">
        <Button onClick={() => setEditOpen(true)} data-testid="edit-quota" disabled={!quota}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Edit quotas
        </Button>
      </PageHeader>

      {dunning?.isActive && (
        <div
          className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950"
          data-testid="dunning-banner"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 space-y-1">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Account overdue
              {dunning.phase && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-800 dark:text-amber-100">
                  {dunning.phase}
                </span>
              )}
            </p>
            <p className="text-amber-800 dark:text-amber-200">
              {dunning.daysOverdue} {dunning.daysOverdue === 1 ? 'day' : 'days'} overdue
              {dunning.overdueAmount > 0 && (
                <> &mdash; overdue amount: <span className="font-medium">${dunning.overdueAmount.toFixed(2)}</span></>
              )}
            </p>
          </div>
          <Link
            to="/admin/billing/invoices"
            className="shrink-0 text-xs font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
            data-testid="dunning-view-invoice"
          >
            View Invoice
          </Link>
        </div>
      )}

      {!quota ? (
        <div className="flex h-40 items-center justify-center rounded-md border bg-card">
          <p className="text-sm text-muted-foreground">No quota configured for this tenant.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-md border bg-card p-4" data-testid="quota-action-badge">
            <ActionIcon className={`h-5 w-5 ${ACTION_COLORS[quota.quotaAction] ?? ''}`} />
            <span className="text-sm font-medium">Enforcement:</span>
            <Badge variant={quota.quotaAction === 'HardBlock' ? 'destructive' : 'outline'}>
              {quota.quotaAction}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="quota-limits">
            <QuotaRow
              label="Concurrent channels"
              limit={quota.maxConcurrentChannels}
            />
            <QuotaRow
              label="Active campaigns"
              limit={quota.maxActiveCampaigns}
            />
            <QuotaRow
              label="Monthly voice minutes"
              limit={quota.maxMonthlyVoiceMinutes}
              usage={usageFor('Voice')}
            />
            <QuotaRow
              label="Monthly messages"
              limit={quota.maxMonthlyMessages}
              usage={usageFor('Sms', 'WhatsApp', 'Email', 'Telegram', 'WebChat')}
            />
            <QuotaRow
              label="Storage"
              limit={quota.maxStorageBytes}
              usage={usageFor('Storage')}
              formatter={formatBytes}
            />
            <QuotaRow
              label="Active agents"
              limit={quota.maxActiveAgents}
            />
          </div>
        </>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit quotas</SheetTitle>
            <SheetDescription>Update usage limits for this tenant.</SheetDescription>
          </SheetHeader>

          <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-channels">Max concurrent channels</Label>
              <Input id="q-channels" type="number" data-testid="quota-channels" {...register('maxConcurrentChannels')} />
              {errors.maxConcurrentChannels && <p className="text-xs text-destructive">{errors.maxConcurrentChannels.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-campaigns">Max active campaigns</Label>
              <Input id="q-campaigns" type="number" data-testid="quota-campaigns" {...register('maxActiveCampaigns')} />
              {errors.maxActiveCampaigns && <p className="text-xs text-destructive">{errors.maxActiveCampaigns.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-voice">Max monthly voice minutes</Label>
              <Input id="q-voice" type="number" data-testid="quota-voice" {...register('maxMonthlyVoiceMinutes')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-messages">Max monthly messages</Label>
              <Input id="q-messages" type="number" data-testid="quota-messages" {...register('maxMonthlyMessages')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-storage">Max storage (bytes)</Label>
              <Input id="q-storage" type="number" data-testid="quota-storage" {...register('maxStorageBytes')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-agents">Max active agents</Label>
              <Input id="q-agents" type="number" data-testid="quota-agents" {...register('maxActiveAgents')} />
            </div>

            <div className="space-y-1.5">
              <Label>Enforcement action</Label>
              <Controller
                name="quotaAction"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" data-testid="quota-action-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTA_ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <SheetFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting} data-testid="quota-submit">
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
