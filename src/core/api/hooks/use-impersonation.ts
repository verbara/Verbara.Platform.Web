import { useMutation } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';
import { toast } from 'sonner';

interface ImpersonateResponse {
  accessToken: string;
  expiresAt: string;
  targetTenantId: string;
  targetTenantName: string;
}

export function useImpersonate() {
  return useMutation({
    mutationFn: async (targetTenantId: string) => {
      const { accessToken, tenantId } = useAuthStore.getState();
      const response = await customFetch<ImpersonateResponse>({
        url: '/api/management/impersonate',
        method: 'POST',
        data: { targetTenantId },
      });
      useAuthStore.getState().startImpersonation(response, accessToken!, tenantId!);
      return response;
    },
    onSuccess: (data) => toast.success(`Now operating as ${data.targetTenantName}`),
    onError: () => toast.error('Failed to start impersonation'),
  });
}

export function useEndImpersonate() {
  return useMutation({
    mutationFn: async () => {
      await customFetch<void>({
        url: '/api/management/impersonate',
        method: 'DELETE',
      });
      useAuthStore.getState().endImpersonation();
    },
    onSuccess: () => toast.success('Impersonation ended'),
  });
}
