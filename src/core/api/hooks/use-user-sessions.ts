import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { customFetch } from '@/core/api/client';

/**
 * Profile-scoped active-session list + revoke hooks for the user sessions
 * page at `/profile/security/sessions` (R5.2 PA.2).
 *
 * The legacy `useMySessions` / `useRevokeSession` in `use-auth-admin.ts`
 * remain in place for the in-place security card on `/admin/profile/security`;
 * this surface is dedicated to the standalone wizard route.
 */

export interface UserSessionDto {
  sessionId: string;
  device: string;
  ipAddress: string;
  location: string | null;
  createdAt: string;
  lastActivity: string;
  isCurrentSession: boolean;
}

const sessionsQueryKey = ['profile', 'security', 'sessions'] as const;

export function useUserSessions() {
  return useQuery({
    queryKey: sessionsQueryKey,
    queryFn: () =>
      customFetch<UserSessionDto[]>({
        url: '/api/v1/profile/security/sessions/',
        method: 'GET',
      }),
    staleTime: 30_000,
  });
}

export function useRevokeUserSession() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (sessionId: string) =>
      customFetch<void>({
        url: `/api/v1/profile/security/sessions/${sessionId}/revoke`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionsQueryKey });
      toast.success(t('toasts.auth.sessionRevoked'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
