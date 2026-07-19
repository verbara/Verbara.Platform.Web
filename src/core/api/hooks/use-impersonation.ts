import { useMutation } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Server response is the named `ImpersonateResponse` schema (openapi-response-adoption,
 *  Platform/ADR-0035). The generated DTO carries `readOnly` (required) + `sessionId` on top
 *  of the previous hand-written shape; `startImpersonation` reads `readOnly` via `?? false`. */
type ImpersonateResponse = components['schemas']['ImpersonateResponse'];

export function useImpersonate() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: async ({
      targetTenantId,
      readOnly,
    }: {
      targetTenantId: string;
      readOnly?: boolean;
    }) => {
      const { accessToken, tenantId } = useAuthStore.getState();
      const response = await customFetch<ImpersonateResponse>({
        url: '/api/v1/management/impersonate',
        method: 'POST',
        data: { targetTenantId, readOnly },
      });
      useAuthStore.getState().startImpersonation(response, accessToken!, tenantId!);
      return response;
    },
    onSuccess: (data) =>
      toast.success(t('toasts.impersonation.startedAs', { tenant: data.targetTenantName })),
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
