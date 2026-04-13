import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface Agent {
  /** Primary identifier returned by the backend. */
  agentId: string;
  /**
   * Alias of {@link agentId} synthesized in `useAgents`/`useAgent` so existing
   * callers (`agent.id`) keep working during the DTO alignment.
   */
  id: string;
  userId: string;
  displayName: string;
  state: string;
  skills: string[];
  extension?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  userEmail?: string | null;
  capacity?: {
    maxVoice: number;
    maxChat: number;
    maxEmail: number;
    maxSms: number;
    maxTotal: number;
  };
  createdAt: string;
}

function hydrate(a: Agent): Agent {
  return { ...a, id: a.agentId, skills: a.skills ?? [] };
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
      return result.items.map(hydrate);
    },
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: async () => {
      const agent = await customFetch<Agent>({ url: `/api/v1/admin/agents/${id}`, method: 'GET' });
      return hydrate(agent);
    },
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
        url: `/api/v1/admin/agents/${agentId}`,
        method: 'PUT',
        data: { status: state },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent state updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
