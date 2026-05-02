import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type CasePriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type CaseStatus = 'Open' | 'Pending' | 'Resolved' | 'Closed';

export interface Case {
  caseId: string;
  caseNumber: string;
  subject: string;
  priority: CasePriority;
  status: CaseStatus;
  contactId: string;
  assignedAgentId: string | null;
  conversationIds: string[];
  createdAt: string;
  updatedAt: string | null;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateCaseRequest {
  subject: string;
  priority: CasePriority;
  contactId: string;
  assignedAgentId?: string;
}

export interface UpdateCaseRequest {
  subject?: string;
  status?: CaseStatus;
  priority?: CasePriority;
  assignedAgentId?: string;
}

export interface CaseFilters {
  status?: CaseStatus;
  priority?: CasePriority;
  page?: number;
  pageSize?: number;
}

export function useCases(filters?: CaseFilters) {
  const params: Record<string, string> = {
    page: String(filters?.page ?? 1),
    pageSize: String(filters?.pageSize ?? 25),
  };
  if (filters?.status) params.status = filters.status;
  if (filters?.priority) params.priority = filters.priority;

  return useQuery({
    queryKey: ['cases', 'list', params],
    queryFn: () =>
      customFetch<PagedResult<Case>>({
        url: '/api/v1/cases',
        method: 'GET',
        params,
      }),
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', 'detail', id],
    queryFn: () =>
      customFetch<Case>({
        url: `/api/v1/cases/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateCaseRequest) =>
      customFetch<Case>({
        url: '/api/v1/cases',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', 'list'] });
      toast.success(t('toasts.cases.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCaseRequest & { id: string }) =>
      customFetch<Case>({
        url: `/api/v1/cases/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cases', 'list'] });
      qc.invalidateQueries({ queryKey: ['cases', 'detail', variables.id] });
      toast.success(t('toasts.cases.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useLinkConversationToCase() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ caseId, conversationId }: { caseId: string; conversationId: string }) =>
      customFetch<Case>({
        url: `/api/v1/cases/${caseId}/conversations/${conversationId}`,
        method: 'POST',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cases', 'list'] });
      qc.invalidateQueries({ queryKey: ['cases', 'detail', variables.caseId] });
      toast.success(t('toasts.cases.conversationLinked'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
