import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Server response is the named `SystemInfoDto` schema (openapi-response-adoption, Platform/ADR-0035). */
export type SystemInfo = components['schemas']['SystemInfoDto'];

/**
 * Server response is the named `LicenseInfoDto` schema (openapi-response-adoption, Platform/ADR-0035).
 *
 * R5.2 PC.4 / triage limitation #11 — backend grace-period state surface.
 * `gracePeriodRemaining` is the System.Text.Json default TimeSpan format
 * — "d.hh:mm:ss" (e.g. "5.00:00:00" for 5 days) — when InGrace; null
 * otherwise. `inGrace` and `blocked` are mutually exclusive booleans
 * driven by `LicenseValidationResult` server-side. `parseGraceDuration`
 * in @/admin/license/license-page is the canonical parser. `maxNodes` is
 * emitted as the AOT wire `number | string` union; every consumer renders it
 * directly (JSX / `ReactNode`-typed `StatCard.value`), so no coercion needed.
 */
export type LicenseInfo = components['schemas']['LicenseInfoDto'];

/**
 * Platform-wide system settings — GET response is the named `SystemSettingsDto`
 * schema (openapi-response-adoption, Platform/ADR-0035). It is a verbatim
 * structural match for `SystemSettingsRequest` (the PUT body), so `tsc -b`
 * catches any upstream drift. Re-exported under the original `SystemSettings`
 * name so existing structural consumers keep working.
 */
export type SystemSettings = components['schemas']['SystemSettingsDto'];

export function useSystemInfo() {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: () =>
      customFetch<SystemInfo>({
        url: '/api/v1/management/system/info',
        method: 'GET',
      }),
  });
}

export function useSystemLicense() {
  return useQuery({
    queryKey: ['system', 'license'],
    queryFn: () =>
      customFetch<LicenseInfo>({
        url: '/api/v1/management/system/license',
        method: 'GET',
      }),
  });
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ['system', 'settings'],
    queryFn: () =>
      customFetch<SystemSettings>({
        url: '/api/v1/management/system/settings',
        method: 'GET',
      }),
  });
}

export function useUpdateSystemSettings() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: SystemSettings) =>
      customFetch<SystemSettings>({
        url: '/api/v1/management/system/settings',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system', 'settings'] });
      toast.success(t('toasts.system.settingsSaved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Body for `PUT /api/v1/management/system/license`. Sourced from the generated
 * `components['schemas']['UpdateLicenseRequest']`
 * (`src/core/api/generated/openapi.d.ts`, openapi-typed-client-admin), not
 * hand-declared — it is a verbatim structural match for the former hand-written
 * interface (`licenseKey: string`), so `tsc -b` now catches any upstream drift.
 * Re-exported under the same `UpdateLicenseRequest` name so callers are unchanged.
 */
export type UpdateLicenseRequest = components['schemas']['UpdateLicenseRequest'];

export interface UpdateLicenseResponse {
  message: string;
}

// Submits a new license key to the platform.
//
// The backend endpoint (PUT /api/v1/management/system/license) currently
// acknowledges receipt and returns an informational message — runtime license
// hot-swap is tracked as a future Pro.Licensing item. The UI still exposes the
// flow so operators can submit keys once the backend wires up activation.
export function useUpdateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLicenseRequest) =>
      customFetch<UpdateLicenseResponse>({
        url: '/api/v1/management/system/license',
        method: 'PUT',
        data,
      }),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['system', 'license'] });
      toast.success(response.message || 'License submitted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── First-time platform setup ──────────────────────────────────────────────

export interface SetupInput {
  email: string;
  password: string;
  displayName?: string;
  platformName?: string;
  customerTenantId: string;
  customerName: string;
  customerAdminEmail: string;
  customerAdminPassword: string;
  customerAdminDisplayName?: string;
}

export interface SetupResponse {
  tenantId: string;
  userId: string;
  accessToken: string;
  managementApiKey: string;
  customerTenantId: string;
  customerUserId: string;
}

export function useSetup() {
  return useMutation({
    mutationFn: (data: SetupInput) =>
      customFetch<SetupResponse>({ url: '/api/v1/setup', method: 'POST', data }),
  });
}
