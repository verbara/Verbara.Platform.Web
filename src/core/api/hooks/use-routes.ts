import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface OutboundRouteSummary {
  id: number;
  pattern: string;
  patternType: string;
  trunkId: number;
  priority: number;
  overflowTrunkId?: number;
  dialPrefix?: string;
}

export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: () =>
      customFetch<OutboundRouteSummary[]>({ url: '/api/admin/routes', method: 'GET' }),
  });
}

export function useRoute(id: number) {
  return useQuery({
    queryKey: ['route', id],
    queryFn: () =>
      customFetch<OutboundRouteSummary>({ url: `/api/admin/routes/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<OutboundRouteSummary, 'id'>>) =>
      customFetch<OutboundRouteSummary>({ url: '/api/admin/routes', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Route created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Omit<OutboundRouteSummary, 'id'>>) =>
      customFetch<OutboundRouteSummary>({
        url: `/api/admin/routes/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      qc.invalidateQueries({ queryKey: ['route', variables.id] });
      toast.success('Route updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/admin/routes/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Route deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReorderRoutes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: number[]) =>
      customFetch<void>({ url: '/api/admin/routes/reorder', method: 'POST', data: orderedIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Routes reordered');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
