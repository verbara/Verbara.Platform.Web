import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
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
    queryFn: () =>
      customFetch<AuthConfig>({ url: '/api/v1/admin/auth/config', method: 'GET' }),
  });
}

export function useUpdateAuthConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AuthConfig>) =>
      customFetch<AuthConfig>({
        url: '/api/v1/admin/auth/config',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success('Auth configuration updated');
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
  return useMutation({
    mutationFn: (sessionId: string) =>
      customFetch<void>({
        url: `/api/v1/admin/auth/sessions/${sessionId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-sessions'] });
      toast.success('Session revoked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useForceLogoutUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      customFetch<void>({
        url: `/api/v1/admin/auth/sessions/user/${userId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-sessions'] });
      toast.success('All sessions revoked for user');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
