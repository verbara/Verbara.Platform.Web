import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

export interface OnboardingStatus {
  wizardCompleted: boolean;
  templateApplied: string | null;
  checklist: ChecklistItem[];
  checklistDismissed: boolean;
}

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ['onboarding', 'status'],
    queryFn: () =>
      customFetch<OnboardingStatus>({
        url: '/api/v1/admin/onboarding/status',
        method: 'GET',
      }),
    staleTime: 5 * 60_000,
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/admin/onboarding/complete',
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding', 'status'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDismissChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/admin/onboarding/dismiss-checklist',
        method: 'PUT',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding', 'status'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (template: string) =>
      customFetch<void>({
        url: '/api/v1/admin/onboarding/apply-template',
        method: 'POST',
        data: { template },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding', 'status'] });
      toast.success(t('toasts.onboarding.templateApplied'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
