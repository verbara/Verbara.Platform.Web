import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

/**
 * A reason hint is an implicit-capture rule: when work arrives through a given
 * scope (a DID, a channel type, or a queue), it pre-stamps the conversation
 * with a reason taxonomy path WITHOUT the agent having to pick it. Mirrors the
 * backend `ReasonHintDto` (camelCase).
 *
 * - `scope` ∈ "Did" | "Channel" | "Queue".
 * - `scopeRef` is the DID (E.164) | a ChannelType name (e.g. "WhatsApp",
 *   "WebChat", "Voice", "Sms", "Email") | a queueId, depending on `scope`.
 * - `reasonPath` is a JSON array string of node Codes, e.g. `["CITAS","REPROG"]`.
 * - `priority` orders overlapping hints (higher wins; lower is default 0).
 */
export interface ReasonHint {
  id: string;
  scope: string;
  scopeRef: string;
  reasonPath: string;
  priority: number;
  isActive: boolean;
}

/** Body for `POST /api/v1/admin/reason-hints` (`CreateReasonHintRequest`). */
export interface CreateReasonHintFields {
  scope: string;
  scopeRef: string;
  reasonPath: string;
  priority: number;
  isActive: boolean;
}

/** Body for `PUT /api/v1/admin/reason-hints/{id}` (`UpdateReasonHintRequest`). */
export type UpdateReasonHintFields = Partial<CreateReasonHintFields>;

export function useReasonHints() {
  return useQuery({
    queryKey: ['reason-hints'],
    queryFn: () => customFetch<ReasonHint[]>({ url: '/api/v1/admin/reason-hints', method: 'GET' }),
  });
}

export function useReasonHint(id: string) {
  return useQuery({
    queryKey: ['reason-hint', id],
    queryFn: () =>
      customFetch<ReasonHint>({ url: `/api/v1/admin/reason-hints/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateReasonHint() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateReasonHintFields) =>
      customFetch<ReasonHint>({ url: '/api/v1/admin/reason-hints', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reason-hints'] });
      toast.success(t('toasts.reasonHints.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateReasonHint() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateReasonHintFields) =>
      customFetch<ReasonHint>({
        url: `/api/v1/admin/reason-hints/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['reason-hints'] });
      qc.invalidateQueries({ queryKey: ['reason-hint', variables.id] });
      toast.success(t('toasts.reasonHints.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteReasonHint() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/reason-hints/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reason-hints'] });
      toast.success(t('toasts.reasonHints.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
