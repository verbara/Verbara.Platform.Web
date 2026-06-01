import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface TrunkSummary {
  id: number;
  name: string;
  displayName: string;
  type: string;
  isActive: boolean;
  maxChannels: number;
  // Optional carrier-config fields. `authPassword` is intentionally absent:
  // it is write-only and never returned by the backend TrunkDto.
  transport?: string | null;
  codecs?: string | null;
  authUsername?: string | null;
  registrationUri?: string | null;
  clientUri?: string | null;
  context?: string | null;
  matchHost?: string | null;
}

/**
 * Fields accepted by the create/update mutations. Includes the write-only
 * `authPassword` secret (which never round-trips through `TrunkSummary`).
 */
export type TrunkWriteFields = Partial<Omit<TrunkSummary, 'id'>> & {
  authPassword?: string;
};

export function useTrunks() {
  return useQuery({
    queryKey: ['trunks'],
    queryFn: () => customFetch<TrunkSummary[]>({ url: '/api/v1/admin/trunks', method: 'GET' }),
  });
}

export function useTrunk(id: number) {
  return useQuery({
    queryKey: ['trunk', id],
    queryFn: () => customFetch<TrunkSummary>({ url: `/api/v1/admin/trunks/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateTrunk() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: TrunkWriteFields) =>
      customFetch<TrunkSummary>({ url: '/api/v1/admin/trunks', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      toast.success(t('toasts.trunks.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTrunk() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & TrunkWriteFields) =>
      customFetch<TrunkSummary>({ url: `/api/v1/admin/trunks/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      qc.invalidateQueries({ queryKey: ['trunk', variables.id] });
      toast.success(t('toasts.trunks.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTrunk() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/trunks/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      toast.success(t('toasts.trunks.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Diagnostic returned by `POST /api/v1/admin/trunks/{id}/test-connectivity`.
 * The server runs `pjsip show ...` over AMI and reports what it found.
 *
 * - `authMode` mirrors the trunk's resolved PJSIP auth strategy: `ip-acl`
 *   (IP-authenticated, expects an identify match), `register` (the trunk
 *   registers against the carrier) or `none` (neither configured).
 * - The per-check booleans are tri-state: `true` (pass), `false` (fail) or
 *   `null` ("not applicable" / "unknown" — e.g. `registered` is `null` for an
 *   `ip-acl` trunk because it never registers).
 * - `ok` is the server's overall verdict. A report with `ok=false` still
 *   returns HTTP 200 — the caller renders it rather than treating it as an
 *   error. Only a missing trunk yields 404.
 * - `messages` are human-readable Spanish diagnostics produced server-side
 *   (e.g. "Registrado contra el carrier", "AMI no disponible…"). They are NOT
 *   i18n keys — render them verbatim.
 */
export interface TrunkConnectivityResult {
  trunkId: number;
  endpointId: string;
  endpointFound: boolean;
  authMode: 'ip-acl' | 'register' | 'none';
  registered: boolean | null;
  identifyPresent: boolean | null;
  reachable: boolean | null;
  ok: boolean;
  messages: string[];
}

/**
 * Runs the server-side connectivity test for a trunk. Returns the diagnostic
 * report so the caller can show a result panel. Does NOT toast on success
 * (the panel surfaces the verdict); a 404 (trunk not found) is toasted so the
 * operator knows the trunk vanished. The `ok=false` 200-report path is left
 * for the caller to render — it is not an error.
 */
export function useTestTrunkConnectivity() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<TrunkConnectivityResult>({
        url: `/api/v1/admin/trunks/${id}/test-connectivity`,
        method: 'POST',
      }),
    onError: (err: Error) => {
      // `customFetch` surfaces a 404 as the message `API error: 404` (the
      // backend ErrorResponse `error` field is not read by the client). Map
      // that to a friendly "trunk not found" toast; otherwise show the raw
      // message (network failure, etc.).
      if (err.message.includes('404')) {
        toast.error(t('toasts.trunks.connectivityNotFound'));
      } else {
        toast.error(err.message);
      }
    },
  });
}

export function useActiveTrunks() {
  return useQuery({
    queryKey: ['trunks', 'active'],
    queryFn: () =>
      customFetch<TrunkSummary[]>({ url: '/api/v1/admin/trunks/active', method: 'GET' }),
  });
}

export function useTrunkByName(name: string) {
  return useQuery({
    queryKey: ['trunks', 'by-name', name],
    queryFn: () =>
      customFetch<TrunkSummary>({
        url: `/api/v1/admin/trunks/by-name/${encodeURIComponent(name)}`,
        method: 'GET',
      }),
    enabled: !!name,
  });
}
