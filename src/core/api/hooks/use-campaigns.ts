import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * The campaign statuses the console knows, lowercase. Platform writes the enum name, PascalCase
 * (`"Draft"`, `"Active"`, `"Archived"`); the read hooks below normalize it once, at this boundary
 * (design D3, dialer-places-calls-end-to-end), so the pages keep comparing lowercase.
 */
const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/**
 * A status as the hooks return it: a known {@link CampaignStatus}, or a value outside the five,
 * passed through unchanged (its raw text), which the pages render with no lifecycle action.
 */
export type CampaignSummaryStatus = CampaignStatus | (string & {});

export function isCampaignStatus(value: string): value is CampaignStatus {
  return (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

/** Lower-cases a known status (`"Archived"` → `"archived"`); any other value passes through. */
export function normalizeCampaignStatus(status: string): CampaignSummaryStatus {
  if (typeof status !== 'string') return status;
  const lower = status.toLowerCase();
  return isCampaignStatus(lower) ? lower : status;
}

function withNormalizedStatus<T extends { status: string }>(campaign: T): T {
  return { ...campaign, status: normalizeCampaignStatus(campaign.status) };
}

export interface CampaignSummary {
  id: number;
  name: string;
  status: CampaignSummaryStatus;
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

type CreateCampaignRequest = components['schemas']['CreateCampaignRequest'];

/**
 * The members a create body always carries (design D2). The non-nullable numbers and `dncEnabled`
 * are required because an absent one binds its default (`0`, `false`) on Platform.
 */
type CreateCampaignRequiredMember =
  | 'name'
  | 'mode'
  | 'targetQueueName'
  | 'timezone'
  | 'schedule'
  | 'holidays'
  | 'maxConcurrentCalls'
  | 'dncEnabled'
  | 'maxAttemptsPerContact'
  | 'retryIntervalMinutes'
  | 'timeBetweenAttemptsMinutes';

/**
 * `POST /api/v1/admin/campaigns` body, from the generated `CreateCampaignRequest`: the members
 * above required, every other one optional. Built as an object literal, it lets TypeScript's
 * excess-property check reject a member the request lacks (`queueId`, `status`, ...) and a
 * numeric `teamId`.
 */
export type CreateCampaignBody = Pick<CreateCampaignRequest, CreateCampaignRequiredMember> &
  Partial<Omit<CreateCampaignRequest, CreateCampaignRequiredMember>>;

/** `PUT /api/v1/admin/campaigns/{id}` body, from the generated `UpdateCampaignRequest`. */
export type UpdateCampaignBody = Partial<components['schemas']['UpdateCampaignRequest']>;

export interface ContactList {
  id: number;
  name: string;
  totalContacts: number;
  pendingContacts: number;
  completedContacts: number;
  sourceFileName?: string;
  createdAt: string;
}

/**
 * A campaign disposition code as `GET /api/v1/admin/campaigns/{id}/dispositions` returns it
 * (`DispositionCodeDto`; host fixtures `disposition-code.response.json` and
 * `disposition-code.target.response.json`). `category` is the enum name (`"Failure"`); read it
 * through {@link normalizeDispositionCategory}. `addsToDnc` exists from Platform v2.32.0; a code read
 * without it does not add to the do-not-call list.
 */
export interface DispositionCode {
  id: number;
  code: string;
  label: string;
  category: string;
  isSuccess: boolean;
  triggerRetry: boolean;
  retryDelayMinutes?: number | null;
  triggerCallback: boolean;
  addsToDnc?: boolean;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Platform's four disposition categories, lowercase, as the console sends them (design D4).
 * Platform returns the enum name (`Success|Failure|Retry|SystemResult`) and parses a request
 * lower-cased, anything else as `SystemResult`.
 */
export const DISPOSITION_CATEGORIES = ['success', 'failure', 'retry', 'systemresult'] as const;

export type DispositionCategory = (typeof DISPOSITION_CATEGORIES)[number];

/** A stored category as the console's lowercase one; anything outside the four is `systemresult`, as Platform stores it. */
export function normalizeDispositionCategory(
  category: string | null | undefined,
): DispositionCategory {
  const lower = (category ?? '').toLowerCase();
  return (DISPOSITION_CATEGORIES as readonly string[]).includes(lower)
    ? (lower as DispositionCategory)
    : 'systemresult';
}

/**
 * `POST /api/v1/admin/campaigns/{id}/dispositions` body: the generated `CreateDispositionCodeRequest`
 * plus `addsToDnc` (boolean), the member host fixture `disposition-code-create.target.request.json`
 * adds in Platform v2.32.0. The intersection is redundant once `openapi.d.ts` is regenerated from
 * Platform v2.32.0's document (task B.4).
 */
export type CreateDispositionCodeBody = components['schemas']['CreateDispositionCodeRequest'] & {
  addsToDnc: boolean;
};

/**
 * `PUT /api/v1/admin/campaigns/{id}/dispositions/{codeId}` body: the generated
 * `UpdateDispositionCodeRequest` (every member nullable, `null` meaning unchanged; no `code`) plus
 * `addsToDnc` (boolean|null) from host fixture `disposition-code-update.target.request.json`.
 */
export type UpdateDispositionCodeBody = components['schemas']['UpdateDispositionCodeRequest'] & {
  addsToDnc: boolean | null;
};

/**
 * An item of `GET /api/v1/operations/campaigns/metrics` (`CampaignMetricsDto`; host fixture
 * `campaign-metrics-list.response.json`). `connectRate` and `abandonRate` are fractions in `[0, 1]`.
 */
export interface CampaignMetrics {
  campaignId: number;
  campaignName: string;
  status: CampaignSummaryStatus;
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
      return result.items.map(withNormalizedStatus);
    },
  });
}

export function useCampaign(id: number) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () =>
      withNormalizedStatus(
        await customFetch<CampaignDetail>({ url: `/api/v1/admin/campaigns/${id}`, method: 'GET' }),
      ),
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

/** The Operations monitor's campaigns, their `status` normalized like every other campaign read (Web #460). */
export function useActiveCampaignMetrics() {
  return useQuery({
    queryKey: ['active-campaign-metrics'],
    queryFn: async () =>
      (
        await customFetch<CampaignMetrics[]>({
          url: '/api/v1/operations/campaigns/metrics',
          method: 'GET',
        })
      ).map(withNormalizedStatus),
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
    mutationFn: async (data: CreateCampaignBody) =>
      withNormalizedStatus(
        await customFetch<CampaignSummary>({
          url: '/api/v1/admin/campaigns',
          method: 'POST',
          data,
        }),
      ),
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
    mutationFn: async ({ id, ...data }: { id: number } & UpdateCampaignBody) =>
      withNormalizedStatus(
        await customFetch<CampaignDetail>({
          url: `/api/v1/admin/campaigns/${id}`,
          method: 'PUT',
          data,
        }),
      ),
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
    mutationFn: ({ campaignId, ...data }: { campaignId: number } & CreateDispositionCodeBody) =>
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
    }: { campaignId: number; codeId: number } & UpdateDispositionCodeBody) =>
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
