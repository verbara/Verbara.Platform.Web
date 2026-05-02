import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// --- Types ---

export interface RateTier {
  fromQuantity: number;
  toQuantity: number | null;
  unitPrice: number;
}

export interface RateEntry {
  usageType: string;
  unitPrice: number;
  includedQuantity: number;
  tiers: RateTier[] | null;
}

export interface RateCard {
  rateCardId: string;
  tenantId: string;
  name: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefault: boolean;
  rates: RateEntry[];
}

export interface CreateRateCardInput {
  name: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefault: boolean;
  rates: RateEntry[];
}

export interface InvoiceLineItem {
  usageType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  includedQuantity: number;
  overageQuantity: number;
}

export interface Invoice {
  invoiceId: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  generatedAt: string;
  issuedAt: string | null;
  paidAt: string | null;
  paymentStatus?: string;
  dueDate?: string | null;
}

export interface GenerateInvoiceInput {
  periodStart: string;
  periodEnd: string;
}

export interface UsageSummary {
  usageType: string;
  totalQuantity: number;
  recordCount: number;
  periodStart: string;
  periodEnd: string;
  lastUpdatedAt: string;
}

export interface UsageRecord {
  recordId: string;
  usageType: string;
  quantity: number;
  unit: string;
  channel: string | null;
  referenceId: string | null;
  recordedAt: string;
}

export interface Quota {
  maxConcurrentChannels: number;
  maxActiveCampaigns: number;
  maxMonthlyVoiceMinutes: number | null;
  maxMonthlyMessages: number | null;
  maxStorageBytes: number | null;
  maxActiveAgents: number | null;
  quotaAction: string;
}

export interface QuotaStatus {
  tenantId: string;
  quota: Quota | null;
  currentUsage: UsageSummary[];
}

export interface UpdateQuotaInput {
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
  maxMonthlyVoiceMinutes?: number | null;
  maxMonthlyMessages?: number | null;
  maxStorageBytes?: number | null;
  maxActiveAgents?: number | null;
  quotaAction?: string;
}

export const USAGE_TYPES = [
  'VoiceInbound', 'VoiceOutbound', 'SmsInbound', 'SmsOutbound',
  'WhatsAppInbound', 'WhatsAppOutbound', 'EmailInbound', 'EmailOutbound',
  'WebChatSession', 'TelegramInbound', 'TelegramOutbound',
  'RecordingStorage', 'MediaStorage', 'DialerAttempt', 'DialerConnected',
  'AgentLoginHour', 'AiAnalysis',
] as const;

export const QUOTA_ACTIONS = ['Warn', 'SoftBlock', 'HardBlock'] as const;

export const INVOICE_STATUSES = ['Draft', 'Issued', 'Paid', 'Void'] as const;

// --- Helper ---

function useBillingTenantId(): string {
  const active = useTenantStore((s) => s.activeTenantId);
  const auth = useAuthStore((s) => s.tenantId);
  return active ?? auth ?? '';
}

// --- Rate Cards ---

export function useRateCards() {
  const tenantId = useBillingTenantId();
  return useQuery({
    queryKey: ['rate-cards', tenantId],
    queryFn: () =>
      customFetch<RateCard[]>({
        url: '/api/v1/management/rate-cards',
        method: 'GET',
        params: { tenantId },
      }),
    enabled: !!tenantId,
  });
}

export function useCreateRateCard() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const tenantId = useBillingTenantId();
  return useMutation({
    mutationFn: (data: CreateRateCardInput) =>
      customFetch<RateCard>({
        url: '/api/v1/management/rate-cards',
        method: 'POST',
        params: { tenantId },
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-cards', tenantId] });
      toast.success(t('toasts.billing.rateCardCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRateCard() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const tenantId = useBillingTenantId();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & CreateRateCardInput) =>
      customFetch<RateCard>({
        url: `/api/v1/management/rate-cards/${id}`,
        method: 'PUT',
        params: { tenantId },
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-cards', tenantId] });
      toast.success(t('toasts.billing.rateCardUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteRateCard() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const tenantId = useBillingTenantId();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/management/rate-cards/${id}`,
        method: 'DELETE',
        params: { tenantId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-cards', tenantId] });
      toast.success(t('toasts.billing.rateCardDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Invoices ---

export function useInvoices(page = 1, pageSize = 20) {
  const tenantId = useBillingTenantId();
  return useQuery({
    queryKey: ['invoices', tenantId, page, pageSize],
    queryFn: () =>
      customFetch<Invoice[]>({
        url: '/api/v1/management/invoices',
        method: 'GET',
        params: { tenantId, page: String(page), pageSize: String(pageSize) },
      }),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const tenantId = useBillingTenantId();
  return useMutation({
    mutationFn: (data: GenerateInvoiceInput) =>
      customFetch<Invoice>({
        url: '/api/v1/management/invoices/generate',
        method: 'POST',
        params: { tenantId },
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', tenantId] });
      toast.success(t('toasts.billing.invoiceGenerated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInvoice(id: string) {
  const tenantId = useBillingTenantId();
  return useQuery({
    queryKey: ['invoice', tenantId, id],
    queryFn: () =>
      customFetch<Invoice>({
        url: `/api/v1/management/invoices/${id}`,
        method: 'GET',
        params: { tenantId },
      }),
    enabled: !!tenantId && !!id,
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const tenantId = useBillingTenantId();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<{ invoiceId: string; status: string }>({
        url: `/api/v1/management/invoices/${id}/issue`,
        method: 'POST',
        params: { tenantId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', tenantId] });
      toast.success(t('toasts.billing.invoiceIssued'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePayInvoice() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (invoiceId: string) =>
      customFetch<void>({
        url: `/api/v1/management/invoices/${invoiceId}/pay`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      toast.success(t('toasts.billing.invoiceMarkedPaid'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Dunning ---

export interface DunningStatus {
  isActive: boolean;
  phase: string | null;
  daysOverdue: number;
  overdueAmount: number;
  invoiceId: string | null;
  isPaused?: boolean;
}

export function useDunningStatus(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['billing', 'dunning', tenantId],
    queryFn: () =>
      customFetch<DunningStatus>({
        url: `/api/v1/management/tenants/${tenantId}/dunning`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}

// R5.3 S4.2 — pause/resume dunning toggle. Backend: existing POST /dunning/pause + R5.3 A.7 POST /dunning/resume.
export interface DunningStatusUpdate {
  paused: boolean;
  reason?: string;
}

export function useUpdateDunningStatus(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: DunningStatusUpdate) =>
      customFetch<void>({
        url: update.paused
          ? `/api/v1/management/tenants/${tenantId}/dunning/pause`
          : `/api/v1/management/tenants/${tenantId}/dunning/resume`,
        method: 'POST',
        data: update.paused ? { reason: update.reason ?? '' } : undefined,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['billing', 'dunning', tenantId] });
      toast.success(
        variables.paused
          ? `Dunning paused${variables.reason ? `: ${variables.reason}` : ''}`
          : 'Dunning resumed',
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Usage ---

export function useUsageSummary(from?: string, until?: string) {
  const tenantId = useBillingTenantId();
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (until) params.until = until;
  return useQuery({
    queryKey: ['usage-summary', tenantId, from, until],
    queryFn: () =>
      customFetch<UsageSummary[]>({
        url: `/api/v1/management/tenants/${tenantId}/usage`,
        method: 'GET',
        params,
      }),
    enabled: !!tenantId,
  });
}

export function useUsageDetails(opts: {
  from?: string;
  until?: string;
  type?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const tenantId = useBillingTenantId();
  const params: Record<string, string> = {};
  if (opts.from) params.from = opts.from;
  if (opts.until) params.until = opts.until;
  if (opts.type) params.type = opts.type;
  if (opts.page) params.page = String(opts.page);
  if (opts.pageSize) params.pageSize = String(opts.pageSize);
  return useQuery({
    queryKey: ['usage-details', tenantId, opts],
    queryFn: () =>
      customFetch<UsageRecord[]>({
        url: `/api/v1/management/tenants/${tenantId}/usage/details`,
        method: 'GET',
        params,
      }),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
}

// --- Quotas ---

export function useQuotaStatus() {
  const tenantId = useBillingTenantId();
  return useQuery({
    queryKey: ['quota-status', tenantId],
    queryFn: () =>
      customFetch<QuotaStatus>({
        url: `/api/v1/management/tenants/${tenantId}/quota`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}

export function useUpdateQuota() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const tenantId = useBillingTenantId();
  return useMutation({
    mutationFn: (data: UpdateQuotaInput) =>
      customFetch<Quota>({
        url: `/api/v1/management/tenants/${tenantId}/quota`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quota-status', tenantId] });
      toast.success(t('toasts.billing.quotaUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
