import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface EndpointProfile {
  id: number;
  name: string;
  type: string;
  isDefault: boolean;
  transport: string;
  codecs: string;
  webrtc: boolean;
  maxContacts: number;
  directMedia: boolean;
  context: string;
  qualifyFrequency: number;
}

export interface CreateEndpointProfilePayload {
  name: string;
  type: string;
  transport?: string;
  codecs?: string;
  webrtc?: boolean;
  maxContacts?: number;
  directMedia?: boolean;
  context?: string;
  qualifyFrequency?: number;
}

export interface UpdateEndpointProfilePayload {
  name?: string;
  transport?: string;
  codecs?: string;
  webrtc?: boolean;
  maxContacts?: number;
  isDefault?: boolean;
  directMedia?: boolean;
  context?: string;
  qualifyFrequency?: number;
}

export function useEndpointProfiles() {
  return useQuery({
    queryKey: ['endpoint-profiles'],
    queryFn: () =>
      customFetch<EndpointProfile[]>({ url: '/api/v1/admin/realtime/profiles', method: 'GET' }),
  });
}

export function useEndpointProfile(id: number) {
  return useQuery({
    queryKey: ['endpoint-profile', id],
    queryFn: () =>
      customFetch<EndpointProfile>({ url: `/api/v1/admin/realtime/profiles/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateEndpointProfile() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateEndpointProfilePayload) =>
      customFetch<EndpointProfile>({ url: '/api/v1/admin/realtime/profiles', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoint-profiles'] });
      toast.success(t('toasts.endpointProfiles.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateEndpointProfile() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateEndpointProfilePayload) =>
      customFetch<EndpointProfile>({ url: `/api/v1/admin/realtime/profiles/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['endpoint-profiles'] });
      qc.invalidateQueries({ queryKey: ['endpoint-profile', variables.id] });
      toast.success(t('toasts.endpointProfiles.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteEndpointProfile() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/realtime/profiles/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoint-profiles'] });
      toast.success(t('toasts.endpointProfiles.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSeedDefaults() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: () =>
      customFetch<void>({ url: '/api/v1/admin/realtime/profiles/seed-defaults', method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['endpoint-profiles'] });
      toast.success(t('toasts.endpointProfiles.defaultsSeeded'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
