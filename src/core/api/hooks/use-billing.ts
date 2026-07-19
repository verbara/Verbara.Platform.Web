import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// --- Types ---
//
// Response shapes alias the named schemas Platform now emits
// (openapi-response-adoption, Platform/ADR-0035); hand-written bodies removed.
// Native AOT emits every numeric field as the `number | string` wire union (the
// document's `["number","string"]` / `["integer","string"]` types); the JSON
// payload always sends a numeric value. Consumers (invoices/usage/quotas/rate-card
// pages) do plain arithmetic / `formatNumber` / `formatCurrency` on these, so the
// exported consumer types keep the numeric fields as `number` and each fetching
// hook normalizes the union at the boundary via `select` / a mutation map (mirrors
// `use-analytics.ts`'s `CsatQueueSummary` + `useCsatQueueAnalytics` pattern).

export interface RateTier extends Omit<
  components['schemas']['RateTierDto'],
  'fromQuantity' | 'toQuantity' | 'unitPrice'
> {
  fromQuantity: number;
  toQuantity: number | null;
  unitPrice: number;
}

export interface RateEntry extends Omit<
  components['schemas']['RateEntryDto'],
  'unitPrice' | 'includedQuantity' | 'tiers'
> {
  unitPrice: number;
  includedQuantity: number;
  tiers: RateTier[] | null;
}

export interface RateCard extends Omit<components['schemas']['RateCardDto'], 'rates'> {
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

export interface InvoiceLineItem extends Omit<
  components['schemas']['InvoiceLineItemDto'],
  'quantity' | 'unitPrice' | 'amount' | 'includedQuantity' | 'overageQuantity'
> {
  quantity: number;
  unitPrice: number;
  amount: number;
  includedQuantity: number;
  overageQuantity: number;
}

export interface Invoice extends Omit<
  components['schemas']['InvoiceDto'],
  'lineItems' | 'subtotal' | 'tax' | 'total'
> {
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface GenerateInvoiceInput {
  periodStart: string;
  periodEnd: string;
}

export interface UsageSummary extends Omit<
  components['schemas']['UsageSummaryDto'],
  'totalQuantity' | 'recordCount'
> {
  totalQuantity: number;
  recordCount: number;
}

export interface UsageRecord extends Omit<components['schemas']['UsageRecordDto'], 'quantity'> {
  quantity: number;
}

export interface Quota extends Omit<
  components['schemas']['QuotaDto'],
  | 'maxConcurrentChannels'
  | 'maxActiveCampaigns'
  | 'maxMonthlyVoiceMinutes'
  | 'maxMonthlyMessages'
  | 'maxStorageBytes'
  | 'maxActiveAgents'
> {
  maxConcurrentChannels: number;
  maxActiveCampaigns: number;
  maxMonthlyVoiceMinutes: number | null;
  maxMonthlyMessages: number | null;
  maxStorageBytes: number | null;
  maxActiveAgents: number | null;
}

export interface QuotaStatus extends Omit<
  components['schemas']['QuotaStatusDto'],
  'quota' | 'currentUsage'
> {
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

// --- Wire-boundary coercions (number | string AOT union -> number) ---

function coerceRateCard(r: components['schemas']['RateCardDto']): RateCard {
  return {
    ...r,
    rates: r.rates.map((e) => ({
      ...e,
      unitPrice: Number(e.unitPrice),
      includedQuantity: Number(e.includedQuantity),
      tiers:
        e.tiers?.map((t) => ({
          ...t,
          fromQuantity: Number(t.fromQuantity),
          toQuantity: t.toQuantity == null ? null : Number(t.toQuantity),
          unitPrice: Number(t.unitPrice),
        })) ?? null,
    })),
  };
}

function coerceInvoice(i: components['schemas']['InvoiceDto']): Invoice {
  return {
    ...i,
    subtotal: Number(i.subtotal),
    tax: Number(i.tax),
    total: Number(i.total),
    lineItems: i.lineItems.map((li) => ({
      ...li,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      amount: Number(li.amount),
      includedQuantity: Number(li.includedQuantity),
      overageQuantity: Number(li.overageQuantity),
    })),
  };
}

function coerceUsageSummary(s: components['schemas']['UsageSummaryDto']): UsageSummary {
  return { ...s, totalQuantity: Number(s.totalQuantity), recordCount: Number(s.recordCount) };
}

function coerceUsageRecord(r: components['schemas']['UsageRecordDto']): UsageRecord {
  return { ...r, quantity: Number(r.quantity) };
}

function coerceQuota(q: components['schemas']['QuotaDto']): Quota {
  return {
    ...q,
    maxConcurrentChannels: Number(q.maxConcurrentChannels),
    maxActiveCampaigns: Number(q.maxActiveCampaigns),
    maxMonthlyVoiceMinutes:
      q.maxMonthlyVoiceMinutes == null ? null : Number(q.maxMonthlyVoiceMinutes),
    maxMonthlyMessages: q.maxMonthlyMessages == null ? null : Number(q.maxMonthlyMessages),
    maxStorageBytes: q.maxStorageBytes == null ? null : Number(q.maxStorageBytes),
    maxActiveAgents: q.maxActiveAgents == null ? null : Number(q.maxActiveAgents),
  };
}

export const USAGE_TYPES = [
  'VoiceInbound',
  'VoiceOutbound',
  'SmsInbound',
  'SmsOutbound',
  'WhatsAppInbound',
  'WhatsAppOutbound',
  'EmailInbound',
  'EmailOutbound',
  'WebChatSession',
  'TelegramInbound',
  'TelegramOutbound',
  'RecordingStorage',
  'MediaStorage',
  'DialerAttempt',
  'DialerConnected',
  'AgentLoginHour',
  'AiAnalysis',
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
      customFetch<components['schemas']['RateCardDto'][]>({
        url: '/api/v1/management/rate-cards',
        method: 'GET',
        params: { tenantId },
      }),
    select: (data): RateCard[] => data.map(coerceRateCard),
    enabled: !!tenantId,
  });
}

export function useCreateRateCard() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const tenantId = useBillingTenantId();
  return useMutation({
    mutationFn: (data: CreateRateCardInput) =>
      customFetch<components['schemas']['RateCardDto']>({
        url: '/api/v1/management/rate-cards',
        method: 'POST',
        params: { tenantId },
        data,
      }).then(coerceRateCard),
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
      customFetch<components['schemas']['RateCardDto']>({
        url: `/api/v1/management/rate-cards/${id}`,
        method: 'PUT',
        params: { tenantId },
        data,
      }).then(coerceRateCard),
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
      customFetch<components['schemas']['InvoiceDto'][]>({
        url: '/api/v1/management/invoices',
        method: 'GET',
        params: { tenantId, page: String(page), pageSize: String(pageSize) },
      }),
    select: (data): Invoice[] => data.map(coerceInvoice),
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
      customFetch<components['schemas']['InvoiceDto']>({
        url: '/api/v1/management/invoices/generate',
        method: 'POST',
        params: { tenantId },
        data,
      }).then(coerceInvoice),
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
      customFetch<components['schemas']['InvoiceDto']>({
        url: `/api/v1/management/invoices/${id}`,
        method: 'GET',
        params: { tenantId },
      }),
    select: coerceInvoice,
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

/** Server response is the named `DunningRecordDto` schema (openapi-response-adoption,
 *  Platform/ADR-0035). `phase`/`daysOverdue`/`overdueAmount` are client-display fields
 *  the DTO does not emit; the dunning panel (`quotas-page.tsx`) reads them, so they are
 *  retained as an extension (mirrors `use-users`' `mfaEnabled`). */
export type DunningStatus = components['schemas']['DunningRecordDto'] & {
  phase?: string | null;
  daysOverdue?: number;
  overdueAmount?: number;
};

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
      customFetch<components['schemas']['UsageSummaryDto'][]>({
        url: `/api/v1/management/tenants/${tenantId}/usage`,
        method: 'GET',
        params,
      }),
    select: (data): UsageSummary[] => data.map(coerceUsageSummary),
    enabled: !!tenantId,
  });
}

export function useUsageDetails(
  opts: {
    from?: string;
    until?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
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
      customFetch<components['schemas']['UsageRecordDto'][]>({
        url: `/api/v1/management/tenants/${tenantId}/usage/details`,
        method: 'GET',
        params,
      }),
    select: (data): UsageRecord[] => data.map(coerceUsageRecord),
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
      customFetch<components['schemas']['QuotaStatusDto']>({
        url: `/api/v1/management/tenants/${tenantId}/quota`,
        method: 'GET',
      }),
    select: (data): QuotaStatus => ({
      ...data,
      quota: data.quota == null ? null : coerceQuota(data.quota),
      currentUsage: data.currentUsage.map(coerceUsageSummary),
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
      customFetch<components['schemas']['QuotaDto']>({
        url: `/api/v1/management/tenants/${tenantId}/quota`,
        method: 'PUT',
        data,
      }).then(coerceQuota),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quota-status', tenantId] });
      toast.success(t('toasts.billing.quotaUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
