import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface CampaignSummary {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  queueName: string;
  mode: string;
  totalContacts: number;
  contactsDialed: number;
}

export interface CampaignDetail extends CampaignSummary {
  description?: string;
  teamName?: string;
  maxConcurrentCalls: number;
  powerRatio?: number;
  targetAbandonRate?: number;
  timezone: string;
  campaignStart?: string;
  campaignEnd?: string;
  schedule: ScheduleDay[];
  holidays: string[];
  dncEnabled: boolean;
  maxAttemptsPerContact: number;
  retryIntervalMinutes: number;
  timeBetweenAttemptsMinutes: number;
  complianceNotes?: string;
  createdAt: string;
}

/**
 * A single day's outbound-calling window within a campaign schedule. Sourced
 * from the generated `components['schemas']['ScheduleDayDto']`
 * (`src/core/api/generated/openapi.d.ts`, openapi-typed-client-admin), not
 * hand-declared — it is a verbatim structural match for the former hand-written
 * interface (`day`, `enabled`, `start`, `end`), so `tsc -b` now catches any
 * upstream drift. Re-exported under the original `ScheduleDay` name so existing
 * structural consumers keep working unchanged.
 */
export type ScheduleDay = components['schemas']['ScheduleDayDto'];

export interface ContactList {
  id: number;
  name: string;
  totalContacts: number;
  pendingContacts: number;
  completedContacts: number;
  sourceFileName?: string;
  createdAt: string;
}

export interface DispositionCode {
  id: number;
  code: string;
  label: string;
  category: string;
  isSuccess: boolean;
  triggerRetry: boolean;
  retryDelayMinutes?: number;
  triggerCallback: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CampaignMetrics {
  campaignId: number;
  campaignName: string;
  status: string;
  contactsDialed: number;
  contactsRemaining: number;
  connectRate: number;
  abandonRate: number;
  activeCalls: number;
  pacingRate: number;
}

export interface ContactImportRow {
  firstName: string;
  lastName?: string;
  phone: string;
  phoneType?: string;
  metadata?: Record<string, string>;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useCampaigns(page = 1, pageSize = 100) {
  return useQuery({
    queryKey: ['campaigns', page, pageSize],
    queryFn: async () => {
      const result = await customFetch<PagedResult<CampaignSummary>>({
        url: '/api/v1/admin/campaigns',
        method: 'GET',
        params: { page: String(page), pageSize: String(pageSize) },
      });
      return result.items;
    },
  });
}

export function useCampaign(id: number) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () =>
      customFetch<CampaignDetail>({ url: `/api/v1/admin/campaigns/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCampaignMetrics(id: number) {
  return useQuery({
    queryKey: ['campaign-metrics', id],
    queryFn: () =>
      customFetch<CampaignMetrics>({ url: `/api/v1/admin/campaigns/${id}/metrics`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useActiveCampaignMetrics() {
  return useQuery({
    queryKey: ['active-campaign-metrics'],
    queryFn: () =>
      customFetch<CampaignMetrics[]>({
        url: '/api/v1/operations/campaigns/metrics',
        method: 'GET',
      }),
  });
}

export function useCampaignContactLists(campaignId: number) {
  return useQuery({
    queryKey: ['campaign-contact-lists', campaignId],
    queryFn: () =>
      customFetch<ContactList[]>({
        url: `/api/v1/admin/campaigns/${campaignId}/contact-lists`,
        method: 'GET',
      }),
    enabled: !!campaignId,
  });
}

export function useCampaignDispositions(campaignId: number) {
  return useQuery({
    queryKey: ['campaign-dispositions', campaignId],
    queryFn: () =>
      customFetch<DispositionCode[]>({
        url: `/api/v1/admin/campaigns/${campaignId}/dispositions`,
        method: 'GET',
      }),
    enabled: !!campaignId,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<Omit<CampaignDetail, 'id' | 'createdAt'>>) =>
      customFetch<CampaignDetail>({ url: '/api/v1/admin/campaigns', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(t('toasts.campaigns.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<Omit<CampaignDetail, 'id' | 'createdAt'>>) =>
      customFetch<CampaignDetail>({
        url: `/api/v1/admin/campaigns/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', variables.id] });
      toast.success(t('toasts.campaigns.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/campaigns/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(t('toasts.campaigns.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartCampaign() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/campaigns/${id}/start`, method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success(t('toasts.campaigns.started'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/campaigns/${id}/pause`, method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success(t('toasts.campaigns.paused'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/campaigns/${id}/resume`, method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success(t('toasts.campaigns.resumed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStopCampaign() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/campaigns/${id}/stop`, method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success(t('toasts.campaigns.stopped'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateContactList() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      campaignId,
      ...data
    }: { campaignId: number } & Partial<Omit<ContactList, 'id' | 'createdAt'>>) =>
      customFetch<ContactList>({
        url: `/api/v1/admin/campaigns/${campaignId}/contact-lists`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaign-contact-lists', variables.campaignId] });
      toast.success(t('toasts.campaigns.contactListCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      campaignId,
      listId,
      contacts,
    }: {
      campaignId: number;
      listId: number;
      contacts: ContactImportRow[];
    }) =>
      customFetch<void>({
        url: `/api/v1/admin/campaigns/${campaignId}/contact-lists/${listId}/import`,
        method: 'POST',
        data: contacts,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaign-contact-lists', variables.campaignId] });
      toast.success(t('toasts.campaigns.contactsImported'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateDispositionCode() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      campaignId,
      ...data
    }: { campaignId: number } & Partial<Omit<DispositionCode, 'id'>>) =>
      customFetch<DispositionCode>({
        url: `/api/v1/admin/campaigns/${campaignId}/dispositions`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaign-dispositions', variables.campaignId] });
      toast.success(t('toasts.campaigns.dispositionCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDispositionCode() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      campaignId,
      codeId,
      ...data
    }: { campaignId: number; codeId: number } & Partial<Omit<DispositionCode, 'id'>>) =>
      customFetch<DispositionCode>({
        url: `/api/v1/admin/campaigns/${campaignId}/dispositions/${codeId}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaign-dispositions', variables.campaignId] });
      toast.success(t('toasts.campaigns.dispositionUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDispositionCode() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ campaignId, codeId }: { campaignId: number; codeId: number }) =>
      customFetch<void>({
        url: `/api/v1/admin/campaigns/${campaignId}/dispositions/${codeId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaign-dispositions', variables.campaignId] });
      toast.success(t('toasts.campaigns.dispositionDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCallbacks(campaignId: number) {
  return useQuery({
    queryKey: ['callbacks', campaignId],
    queryFn: () =>
      customFetch<
        Array<{ campaignId: number; contactId: number; scheduledAt: string; agentId?: string }>
      >({
        url: `/api/v1/admin/campaigns/${campaignId}/callbacks`,
        method: 'GET',
      }),
    enabled: !!campaignId,
  });
}

export function useCreateCallback() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      campaignId,
      contactId,
      phone,
      agentId,
      scheduledAt,
    }: {
      campaignId: number;
      contactId: number;
      phone: string;
      agentId?: string;
      scheduledAt: string;
    }) =>
      customFetch<void>({
        url: `/api/v1/admin/campaigns/${campaignId}/callbacks`,
        method: 'POST',
        data: { contactId, phone, agentId, scheduledAt },
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['callbacks', vars.campaignId] });
      toast.success(t('toasts.campaigns.callbackScheduled'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
