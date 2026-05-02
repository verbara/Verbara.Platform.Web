import { useMutation } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface ImpersonateResponse {
  accessToken: string;
  expiresAt: string;
  targetTenantId: string;
  targetTenantName: string;
  readOnly?: boolean;
}

export function useImpersonate() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: async ({ targetTenantId, readOnly }: { targetTenantId: string; readOnly?: boolean }) => {
      const { accessToken, tenantId } = useAuthStore.getState();
      const response = await customFetch<ImpersonateResponse>({
        url: '/api/v1/management/impersonate',
        method: 'POST',
        data: { targetTenantId, readOnly },
      });
      useAuthStore.getState().startImpersonation(response, accessToken!, tenantId!);
      return response;
    },
    onSuccess: (data) => toast.success(t('toasts.impersonation.startedAs', { tenant: data.targetTenantName })),
    onError: () => toast.error(t('toasts.impersonation.startFailed')),
  });
}

export function useEndImpersonate() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: async () => {
      await customFetch<void>({
        url: '/api/v1/management/impersonate',
        method: 'DELETE',
      });
      useAuthStore.getState().endImpersonation();
    },
    onSuccess: () => toast.success(t('toasts.impersonation.ended')),
  });
}
