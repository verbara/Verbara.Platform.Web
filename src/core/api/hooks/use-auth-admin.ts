import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// --- Types ---

export interface AuthConfig {
  mfaPolicy: 'optional' | 'required_for_roles' | 'required_all';
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
  oidcClientSecret: string | null;
  oidcAutoCreateUsers: boolean;
  oidcDefaultRole: string;
}

export interface AuthEvent {
  eventId: string;
  tenantId: string;
  userId: string | null;
  userEmail?: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActivity: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- Auth Config ---

export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth-config'],
    queryFn: () => customFetch<AuthConfig>({ url: '/api/v1/admin/auth/config', method: 'GET' }),
  });
}

export function useUpdateAuthConfig() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<AuthConfig>) =>
      customFetch<AuthConfig>({
        url: '/api/v1/admin/auth/config',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success(t('toasts.auth.configUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Auth Events ---

export function useAuthEvents(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['auth-events', params],
    queryFn: () =>
      customFetch<PagedResult<AuthEvent>>({
        url: '/api/v1/admin/auth/events',
        method: 'GET',
        params,
      }),
    placeholderData: (prev) => prev,
  });
}

// --- Active Sessions ---

export function useActiveSessions() {
  return useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () =>
      customFetch<ActiveSession[]>({ url: '/api/v1/admin/auth/sessions', method: 'GET' }),
    refetchInterval: 30_000,
  });
}

export function useForceLogout() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (sessionId: string) =>
      customFetch<void>({
        url: `/api/v1/admin/auth/sessions/${sessionId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-sessions'] });
      toast.success(t('toasts.auth.sessionRevoked'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useForceLogoutUser() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (userId: string) =>
      customFetch<void>({
        url: `/api/v1/admin/auth/sessions/by-user/${userId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-sessions'] });
      toast.success(t('toasts.auth.allSessionsRevokedForUser'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- User-scoped MFA + Password + Sessions (Sub C T1.2) ---

export interface MfaSetupResponse {
  secret: string;
  qrUri: string;
  recoveryCodes: string[];
}

export function useSetupMfa() {
  return useMutation({
    mutationFn: () =>
      customFetch<MfaSetupResponse>({
        url: '/api/v1/auth/mfa/setup',
        method: 'POST',
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useConfirmMfa() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (code: string) =>
      customFetch<void>({
        url: '/api/v1/auth/mfa/confirm',
        method: 'POST',
        data: { code },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success(t('toasts.auth.mfaEnabled'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDisableMfa() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (password: string) =>
      customFetch<void>({
        url: '/api/v1/auth/mfa',
        method: 'DELETE',
        data: { password },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success(t('toasts.auth.mfaDisabled'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Body for `POST /api/v1/auth/change-password`. Sourced from the generated
 * `components['schemas']['ChangePasswordRequest']`
 * (`src/core/api/generated/openapi.d.ts`, openapi-typed-client-admin), not
 * hand-declared. The generated schema is a non-breaking superset of the former
 * hand-written interface: the two required fields (`oldPassword`, `newPassword`)
 * are unchanged and it adds an optional `mfaCode?: string | null`, so existing
 * callers that send only the two fields keep compiling. `tsc -b` now catches any
 * upstream drift of this contract.
 */
export type ChangePasswordRequest = components['schemas']['ChangePasswordRequest'];

export function useChangePassword() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      customFetch<void>({
        url: '/api/v1/auth/change-password',
        method: 'POST',
        data,
      }),
    onSuccess: () => toast.success(t('toasts.auth.passwordChanged')),
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface UserSession {
  tokenId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}

export function useMySessions() {
  return useQuery({
    queryKey: ['auth', 'sessions', 'me'],
    queryFn: () =>
      customFetch<UserSession[]>({
        url: '/api/v1/auth/sessions',
        method: 'GET',
      }),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (tokenId: string) =>
      customFetch<void>({
        url: `/api/v1/auth/sessions/${tokenId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions', 'me'] });
      toast.success(t('toasts.auth.sessionRevoked'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/auth/sessions/revoke-others',
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions', 'me'] });
      toast.success(t('toasts.auth.allOtherSessionsSignedOut'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface RecoveryCodesResponse {
  recoveryCodes: string[];
}

export function useRegenerateRecoveryCodes() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (password: string) =>
      customFetch<RecoveryCodesResponse>({
        url: '/api/v1/auth/mfa/recovery-codes/regenerate',
        method: 'POST',
        data: { password },
      }),
    onSuccess: () => toast.success(t('toasts.auth.recoveryCodesRegenerated')),
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

export function usePasswordPolicy() {
  return useQuery({
    queryKey: ['auth', 'password-policy'],
    queryFn: () =>
      customFetch<PasswordPolicy>({
        url: '/api/v1/auth/password-policy',
        method: 'GET',
      }),
    staleTime: Infinity,
  });
}
