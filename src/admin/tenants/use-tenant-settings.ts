import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ─── Backend DTO mirrors ─────────────────────────────────────────────────────
//
// Mirrors `TenantSettingsDto` exposed by
// `GET /api/v1/management/tenants/{id}/settings` (see
// `Asterisk.Platform.Api.Endpoints.TenantSettingsEndpoints.BuildSettingsDto`).
// Field names are camelCase per ASP.NET Core JSON defaults.

export interface OperationalSettings {
  maxConcurrentChannels: number;
  maxActiveCampaigns: number;
  dialplanContextPrefix: string | null;
  nodeAffinity: string[] | null;
  allowedDialingModes: number[] | null;
  /** Tenant-level outbound caller ID for agent click-to-dial + external blind transfer (3B.2d). */
  outboundCallerId: string | null;
}

export interface AuthSettings {
  mfaPolicy: string;
  mfaRequiredRoles: string[];
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  lockoutThreshold: number;
  lockoutDurationMinutes: number;
  sessionIdleTimeoutMinutes: number;
  sessionAbsoluteTimeoutHours: number;
  oidcEnabled: boolean;
  oidcAuthority: string | null;
  oidcClientId: string | null;
  oidcAutoCreateUsers: boolean;
  oidcDefaultRole: string;
  impersonationMaxConcurrentSessions: number;
  impersonationAutoTimeoutMinutes: number;
}

export interface QuotaSettings {
  maxMonthlyVoiceMinutes: number | null;
  maxMonthlyMessages: number | null;
  maxStorageBytes: number | null;
  maxActiveAgents: number | null;
  quotaAction: string;
}

export interface RetentionSettings {
  conversationRetentionDays: number | null;
  authEventRetentionDays: number | null;
  auditRetentionDays: number | null;
  usageRecordRetentionDays: number | null;
}

export interface TenantSettingsDto {
  tenantId: string;
  name: string;
  type: string;
  status: string;
  operational: OperationalSettings;
  auth: AuthSettings;
  quotas: QuotaSettings;
  retention: RetentionSettings;
  rateLimitTier: string;
  plan: string;
  enabledFeatures: string[];
  addOns: string[];
  dunning: unknown | null;
  branding: unknown | null;
}

// Update payloads — all fields optional so each tab can submit only its
// own slice. Mirrors `ManagementUpdateTenantSettingsRequest`.

export interface UpdateOperationalPayload {
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
  dialplanContextPrefix?: string | null;
  nodeAffinity?: string[] | null;
  allowedDialingModes?: number[] | null;
  outboundCallerId?: string | null;
}

export interface UpdateAuthPayload {
  mfaPolicy?: string;
  passwordMinLength?: number;
  passwordRequireUppercase?: boolean;
  passwordRequireNumber?: boolean;
  passwordRequireSpecial?: boolean;
  lockoutThreshold?: number;
  lockoutDurationMinutes?: number;
  sessionIdleTimeoutMinutes?: number;
  sessionAbsoluteTimeoutHours?: number;
  oidcEnabled?: boolean;
  oidcAuthority?: string | null;
  oidcClientId?: string | null;
  /** Write-only: backend never returns this in GET responses. Omit to keep current secret. */
  oidcClientSecret?: string | null;
  oidcAutoCreateUsers?: boolean;
  oidcDefaultRole?: string;
  impersonationMaxConcurrentSessions?: number;
  impersonationAutoTimeoutMinutes?: number;
}

export interface UpdateQuotaPayload {
  maxMonthlyVoiceMinutes?: number | null;
  maxMonthlyMessages?: number | null;
  maxStorageBytes?: number | null;
  maxActiveAgents?: number | null;
  quotaAction?: string;
}

export interface UpdateRetentionPayload {
  conversationRetentionDays?: number | null;
  authEventRetentionDays?: number | null;
  auditRetentionDays?: number | null;
  usageRecordRetentionDays?: number | null;
}

export interface UpdateTenantSettingsPayload {
  operational?: UpdateOperationalPayload;
  auth?: UpdateAuthPayload;
  quotas?: UpdateQuotaPayload;
  retention?: UpdateRetentionPayload;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function tenantSettingsQueryKey(tenantId: string) {
  return ['tenant-settings', tenantId] as const;
}

export function useTenantSettings(tenantId: string) {
  return useQuery({
    queryKey: tenantSettingsQueryKey(tenantId),
    queryFn: () =>
      customFetch<TenantSettingsDto>({
        url: `/api/v1/management/tenants/${tenantId}/settings`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}

export function useUpdateTenantSettings(tenantId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: UpdateTenantSettingsPayload) =>
      customFetch<TenantSettingsDto>({
        url: `/api/v1/management/tenants/${tenantId}/settings`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantSettingsQueryKey(tenantId) });
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success(t('toasts.tenantSettings.saved'));
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save settings'),
  });
}

// ─── IP Allowlist ───────────────────────────────────────────────────────────

export interface IpAllowlistEntry {
  id: string;
  cidr: string;
  description: string;
  createdAt: string;
}

export interface CreateIpAllowlistInput {
  cidr: string;
  description: string;
}

export function ipAllowlistQueryKey(tenantId: string) {
  return ['ip-allowlist', tenantId] as const;
}

export function useIpAllowlist(tenantId: string) {
  return useQuery({
    queryKey: ipAllowlistQueryKey(tenantId),
    queryFn: () =>
      customFetch<IpAllowlistEntry[]>({
        url: `/api/v1/management/tenants/${tenantId}/ip-allowlist`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}

export function useAddIpAllowlistEntry(tenantId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateIpAllowlistInput) =>
      customFetch<IpAllowlistEntry>({
        url: `/api/v1/management/tenants/${tenantId}/ip-allowlist`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipAllowlistQueryKey(tenantId) });
      toast.success(t('toasts.ipAllowlist.added'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveIpAllowlistEntry(tenantId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (entryId: string) =>
      customFetch<void>({
        url: `/api/v1/management/tenants/${tenantId}/ip-allowlist/${entryId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipAllowlistQueryKey(tenantId) });
      toast.success(t('toasts.ipAllowlist.removed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
