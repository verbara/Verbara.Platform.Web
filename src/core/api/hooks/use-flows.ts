import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface FlowNodeDto {
  nodeId: string;
  type: string;
  config: Record<string, string>;
  edges: { condition: string; targetNodeId: string }[];
}

export interface FlowDefinition {
  flowId: string;
  name: string;
  version: number;
  isPublished: boolean;
  updatedAt: string;
  nodes: FlowNodeDto[];
}

export function useFlows() {
  return useQuery({
    queryKey: ['flows'],
    queryFn: () =>
      customFetch<FlowDefinition[]>({
        url: '/api/v1/admin/flows',
        method: 'GET',
      }),
  });
}

export function useFlow(id: string | undefined) {
  return useQuery({
    queryKey: ['flows', id],
    queryFn: () =>
      customFetch<FlowDefinition>({
        url: `/api/v1/admin/flows/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useCreateFlow() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: {
      name: string;
      entryNodeId: string;
      nodes: FlowNodeDto[];
    }) =>
      customFetch<FlowDefinition>({
        url: '/api/v1/admin/flows',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flows'] });
      toast.success(t('toasts.flows.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateFlow() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      entryNodeId?: string;
      nodes?: FlowNodeDto[];
    }) =>
      customFetch<FlowDefinition>({
        url: `/api/v1/admin/flows/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flows'] });
      toast.success(t('toasts.flows.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePublishFlow() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/admin/flows/${id}/publish`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flows'] });
      toast.success(t('toasts.flows.published'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
