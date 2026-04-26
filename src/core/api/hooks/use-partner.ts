import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';
import type { RateCard, CreateRateCardInput, Invoice, UsageSummary } from './use-billing';

// --- Types ---

export interface PartnerCustomer {
  tenantId: string;
  name: string;
  status: string;
  plan: string;
  createdAt: string;
}

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

export interface PartnerRevenueSummary {
  totalGross: number;
  totalPlatformCost: number;
  totalMargin: number;
  customerCount: number;
  invoiceCount: number;
}

export interface PartnerRevenueDetail {
  revenueId: string;
  customerTenantId: string;
  invoiceId: string;
  grossAmount: number;
  platformCost: number;
  partnerMargin: number;
  periodStart: string;
  periodEnd: string;
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
  return useMutation({
    mutationFn: (data: CreatePartnerCustomerInput) =>
      customFetch<PartnerCustomer>({
        url: '/api/v1/partner/customers',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-customers'] });
      toast.success('Customer created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePartnerCustomer() {
  const qc = useQueryClient();
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
      toast.success('Customer updated');
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
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<StatusUpdateResponse>({
        url: `/api/v1/partner/customers/${id}/activate`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['partner-customers'] });
      qc.invalidateQueries({ queryKey: ['partner-customer', id] });
      toast.success('Customer activated');
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
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & TenantSettings) =>
      customFetch<TenantSettings>({
        url: `/api/v1/partner/customers/${id}/settings`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['partner-customer-settings', vars.id] });
      toast.success('Customer settings updated');
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
  return useMutation({
    mutationFn: (data: CreateRateCardInput) =>
      customFetch<RateCard>({
        url: '/api/v1/partner/rate-cards',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-rate-cards'] });
      toast.success('Rate card created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePartnerRateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & CreateRateCardInput) =>
      customFetch<RateCard>({
        url: `/api/v1/partner/rate-cards/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-rate-cards'] });
      toast.success('Rate card updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePartnerRateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/partner/rate-cards/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-rate-cards'] });
      toast.success('Rate card deleted');
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
      toast.success('Invoice generated');
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
      customFetch<PartnerRevenueSummary>({
        url: '/api/v1/partner/revenue/',
        method: 'GET',
        params,
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
      customFetch<PartnerRevenueDetail[]>({
        url: '/api/v1/partner/revenue/details',
        method: 'GET',
        params,
      }),
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
  return useMutation({
    mutationFn: (data: TenantSettings) =>
      customFetch<TenantSettings>({
        url: '/api/v1/partner/settings/',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-settings'] });
      toast.success('Partner settings updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
