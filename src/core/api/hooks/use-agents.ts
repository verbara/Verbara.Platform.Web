import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface Agent {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  state: string;
  teamId?: string;
  teamName?: string;
  skills: { name: string; proficiency: number }[];
  queueIds: string[];
  createdAt: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const result = await customFetch<PagedResult<Agent>>({
        url: '/api/v1/admin/agents',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
      return result.items;
    },
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () =>
      customFetch<Agent>({ url: `/api/v1/admin/agents/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useAgentMe() {
  return useQuery({
    queryKey: ['agent-me'],
    queryFn: () =>
      customFetch<Agent>({ url: '/api/v1/agents/me', method: 'GET' }),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; displayName: string }) =>
      customFetch<Agent>({ url: '/api/v1/admin/agents', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      displayName?: string;
      teamId?: string;
      skills?: { name: string; proficiency: number }[];
    }) =>
      customFetch<Agent>({
        url: `/api/v1/admin/agents/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/agents/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAgentState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { state: string }) =>
      customFetch<void>({
        url: '/api/v1/agents/me/state',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-me'] });
      toast.success('State updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAgentStateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, state }: { agentId: string; state: string }) =>
      customFetch<void>({
        url: `/api/v1/admin/agents/${agentId}/state`,
        method: 'PUT',
        data: { state },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent state updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
