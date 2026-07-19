import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { RateCard, CreateRateCardInput, Invoice, UsageSummary } from './use-billing';

// --- Types ---

/** Server response is the named `PartnerCustomerDto` schema (openapi-response-adoption,
 *  Platform/ADR-0035). Exact field-for-field match — direct alias, no extensions. */
export type PartnerCustomer = components['schemas']['PartnerCustomerDto'];

export interface CreatePartnerCustomerInput {
  tenantId: string;
  name: string;
  plan?: string;
  template?: string;
}

export interface UpdatePartnerCustomerInput {
  name?: string;
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
}

export interface PartnerRevenueSnapshot {
  grossAmount: number;
  platformCost: number;
  partnerMargin: number;
}

export interface PartnerGenerateInvoiceResponse {
  invoice: Invoice;
  revenue: PartnerRevenueSnapshot;
}

/**
 * Server response is the named `PartnerRevenueSummaryDto` schema
 * (openapi-response-adoption, Platform/ADR-0035). Native AOT emits every numeric
 * field as the `number | string` wire union (the document's `["number","string"]` /
 * `["integer","string"]` types); the JSON payload always sends a numeric value.
 * Consumers (`revenue-page.tsx`) do plain arithmetic/`formatCurrency` on these, so
 * the exported consumer type keeps them as `number` and `usePartnerRevenueSummary`
 * normalizes the union at the fetch boundary via `select` (mirrors
 * `use-analytics.ts` `CsatQueueSummary`). */
export interface PartnerRevenueSummary extends Omit<
  components['schemas']['PartnerRevenueSummaryDto'],
  'totalGross' | 'totalPlatformCost' | 'totalMargin' | 'customerCount' | 'invoiceCount'
> {
  totalGross: number;
  totalPlatformCost: number;
  totalMargin: number;
  customerCount: number;
  invoiceCount: number;
}

/**
 * Server response is the named `PartnerRevenueDetailDto` schema
 * (openapi-response-adoption, Platform/ADR-0035). As with {@link PartnerRevenueSummary},
 * the AOT `number | string` union amount fields are normalized to `number` at the
 * fetch boundary (`usePartnerRevenueDetails`'s `select`) so `revenue-page.tsx` keeps
 * doing arithmetic (`grossAmount > 0`, `partnerMargin / grossAmount`, `+=`) and
 * `formatCurrency` on them. */
export interface PartnerRevenueDetail extends Omit<
  components['schemas']['PartnerRevenueDetailDto'],
  'grossAmount' | 'platformCost' | 'partnerMargin'
> {
  grossAmount: number;
  platformCost: number;
  partnerMargin: number;
}

export interface TenantSettings {
  platformName?: string;
  defaultTimezone?: string;
  defaultLanguage?: string;
  [key: string]: unknown;
}

export interface StatusUpdateResponse {
  tenantId: string;
  status: string;
}

export const PARTNER_PLAN_OPTIONS = ['Starter', 'Pro', 'Enterprise'] as const;
export const PARTNER_TEMPLATE_OPTIONS = ['support', 'sales', 'blended'] as const;

// --- Customers ---

export function usePartnerCustomers(status?: string, plan?: string) {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (plan) params.plan = plan;
  return useQuery({
    queryKey: ['partner-customers', status, plan],
    queryFn: () =>
      customFetch<PartnerCustomer[]>({
        url: '/api/v1/partner/customers',
        method: 'GET',
        params,
      }),
  });
}

export function usePartnerCustomer(customerId: string) {
  return useQuery({
    queryKey: ['partner-customer', customerId],
    queryFn: () =>
      customFetch<PartnerCustomer>({
        url: `/api/v1/partner/customers/${customerId}`,
        method: 'GET',
      }),
    enabled: !!customerId,
  });
}

export function useCreatePartnerCustomer() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreatePartnerCustomerInput) =>
      customFetch<PartnerCustomer>({
        url: '/api/v1/partner/customers',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-customers'] });
      toast.success(t('toasts.partner.customerCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePartnerCustomer() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdatePartnerCustomerInput) =>
      customFetch<PartnerCustomer>({
        url: `/api/v1/partner/customers/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['partner-customers'] });
      qc.invalidateQueries({ queryKey: ['partner-customer', vars.id] });
      toast.success(t('toasts.partner.customerUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface SuspendCustomerInput {
  id: string;
  /**
   * Free-text reason captured client-side. The backend currently does not
   * accept a payload on POST /suspend — see TODO(R5.3 B.3.b): backend should
   * accept reason payload. Until the backend follow-up lands, the reason is
   * surfaced in the success toast and not persisted server-side.
   */
  reason: string;
}

export function useSuspendCustomer() {
  const qc = useQueryClient();
  return useMutation({
    // TODO(R5.3 B.3.b): backend should accept reason payload. For now we send
    // an empty body and surface the reason in the client-side success toast.
    mutationFn: ({ id }: SuspendCustomerInput) =>
      customFetch<StatusUpdateResponse>({
        url: `/api/v1/partner/customers/${id}/suspend`,
        method: 'POST',
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['partner-customers'] });
      qc.invalidateQueries({ queryKey: ['partner-customer', vars.id] });
      const reason = vars.reason.trim();
      toast.success(reason ? `Customer suspended — reason: ${reason}` : 'Customer suspended');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateCustomer() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<StatusUpdateResponse>({
        url: `/api/v1/partner/customers/${id}/activate`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['partner-customers'] });
      qc.invalidateQueries({ queryKey: ['partner-customer', id] });
      toast.success(t('toasts.partner.customerActivated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCustomerSettings(customerId: string) {
  return useQuery({
    queryKey: ['partner-customer-settings', customerId],
    queryFn: () =>
      customFetch<TenantSettings>({
        url: `/api/v1/partner/customers/${customerId}/settings`,
        method: 'GET',
      }),
    enabled: !!customerId,
  });
}

export function useUpdateCustomerSettings() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & TenantSettings) =>
      customFetch<TenantSettings>({
        url: `/api/v1/partner/customers/${id}/settings`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['partner-customer-settings', vars.id] });
      toast.success(t('toasts.partner.customerSettingsUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Rate Cards ---

export function usePartnerRateCards() {
  return useQuery({
    queryKey: ['partner-rate-cards'],
    queryFn: () =>
      customFetch<RateCard[]>({
        url: '/api/v1/partner/rate-cards',
        method: 'GET',
      }),
  });
}

export function useCreatePartnerRateCard() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateRateCardInput) =>
      customFetch<RateCard>({
        url: '/api/v1/partner/rate-cards',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-rate-cards'] });
      toast.success(t('toasts.partner.rateCardCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePartnerRateCard() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & CreateRateCardInput) =>
      customFetch<RateCard>({
        url: `/api/v1/partner/rate-cards/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-rate-cards'] });
      toast.success(t('toasts.partner.rateCardUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePartnerRateCard() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/partner/rate-cards/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-rate-cards'] });
      toast.success(t('toasts.partner.rateCardDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Customer Invoices & Usage ---

export function useCustomerInvoices(customerId: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['partner-customer-invoices', customerId, page, pageSize],
    queryFn: () =>
      customFetch<Invoice[]>({
        url: `/api/v1/partner/customers/${customerId}/invoices`,
        method: 'GET',
        params: { page: String(page), pageSize: String(pageSize) },
      }),
    enabled: !!customerId,
    placeholderData: (prev) => prev,
  });
}

export function useGeneratePartnerInvoice(customerId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (range: { from?: string; to?: string }) => {
      const params: Record<string, string> = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      return customFetch<PartnerGenerateInvoiceResponse>({
        url: `/api/v1/partner/customers/${customerId}/invoices/generate`,
        method: 'POST',
        params,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-customer-invoices', customerId] });
      qc.invalidateQueries({ queryKey: ['partner-revenue-summary'] });
      qc.invalidateQueries({ queryKey: ['partner-revenue-details'] });
      toast.success(t('toasts.partner.invoiceGenerated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCustomerUsage(customerId: string) {
  return useQuery({
    queryKey: ['partner-customer-usage', customerId],
    queryFn: () =>
      customFetch<UsageSummary[]>({
        url: `/api/v1/partner/customers/${customerId}/usage`,
        method: 'GET',
      }),
    enabled: !!customerId,
  });
}

// --- Revenue ---

export function usePartnerRevenueSummary(from?: string, until?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (until) params.until = until;
  return useQuery({
    queryKey: ['partner-revenue-summary', from, until],
    queryFn: () =>
      customFetch<components['schemas']['PartnerRevenueSummaryDto']>({
        url: '/api/v1/partner/revenue/',
        method: 'GET',
        params,
      }),
    // Boundary coercion: normalize the AOT `number | string` wire union to `number`.
    select: (d): PartnerRevenueSummary => ({
      totalGross: Number(d.totalGross),
      totalPlatformCost: Number(d.totalPlatformCost),
      totalMargin: Number(d.totalMargin),
      customerCount: Number(d.customerCount),
      invoiceCount: Number(d.invoiceCount),
    }),
  });
}

export function usePartnerRevenueDetails(from?: string, until?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (until) params.until = until;
  return useQuery({
    queryKey: ['partner-revenue-details', from, until],
    queryFn: () =>
      customFetch<components['schemas']['PartnerRevenueDetailDto'][]>({
        url: '/api/v1/partner/revenue/details',
        method: 'GET',
        params,
      }),
    // Boundary coercion: normalize each row's AOT `number | string` amount union to `number`.
    select: (rows): PartnerRevenueDetail[] =>
      rows.map((r) => ({
        ...r,
        grossAmount: Number(r.grossAmount),
        platformCost: Number(r.platformCost),
        partnerMargin: Number(r.partnerMargin),
      })),
  });
}

// --- Partner Settings ---

export function usePartnerSettings() {
  return useQuery({
    queryKey: ['partner-settings'],
    queryFn: () =>
      customFetch<TenantSettings>({
        url: '/api/v1/partner/settings/',
        method: 'GET',
      }),
  });
}

export function useUpdatePartnerSettings() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: TenantSettings) =>
      customFetch<TenantSettings>({
        url: '/api/v1/partner/settings/',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-settings'] });
      toast.success(t('toasts.partner.settingsUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
