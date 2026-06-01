import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

/**
 * An inbound DID route maps a phone number (the destination of an inbound
 * INVITE, in E.164) to the queue that should answer it. The #1 rule is that a
 * DID never exists without a destination queue — the create/update mutations
 * always carry a `queueId`.
 *
 * Mirrors the backend `DidRouteDto` (camelCase). `updatedAt` is optional because
 * a freshly created route has only `createdAt`.
 */
export interface DidRouteSummary {
  id: string;
  did: string;
  queueId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

/** Body for `POST /api/v1/admin/did-routes` (`CreateDidRouteRequest`). */
export interface CreateDidRouteFields {
  did: string;
  queueId: string;
  isActive: boolean;
}

/** Body for `PUT /api/v1/admin/did-routes/{id}` (`UpdateDidRouteRequest`) — all optional. */
export type UpdateDidRouteFields = Partial<CreateDidRouteFields>;

export function useDidRoutes() {
  return useQuery({
    queryKey: ['did-routes'],
    queryFn: () =>
      customFetch<DidRouteSummary[]>({ url: '/api/v1/admin/did-routes', method: 'GET' }),
  });
}

export function useDidRoute(id: string) {
  return useQuery({
    queryKey: ['did-route', id],
    queryFn: () =>
      customFetch<DidRouteSummary>({ url: `/api/v1/admin/did-routes/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useActiveDidRoutes() {
  return useQuery({
    queryKey: ['did-routes', 'active'],
    queryFn: () =>
      customFetch<DidRouteSummary[]>({ url: '/api/v1/admin/did-routes/active', method: 'GET' }),
  });
}

export function useCreateDidRoute() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateDidRouteFields) =>
      customFetch<DidRouteSummary>({ url: '/api/v1/admin/did-routes', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['did-routes'] });
      toast.success(t('toasts.didRoutes.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDidRoute() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateDidRouteFields) =>
      customFetch<DidRouteSummary>({
        url: `/api/v1/admin/did-routes/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['did-routes'] });
      qc.invalidateQueries({ queryKey: ['did-route', variables.id] });
      toast.success(t('toasts.didRoutes.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDidRoute() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/did-routes/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['did-routes'] });
      toast.success(t('toasts.didRoutes.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
