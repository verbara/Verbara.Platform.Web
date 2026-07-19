// R5.1 Phase 2 Task Q — Management API Keys hooks.
//
// Backend surface is already complete (see
// `/api/v1/management/api-keys` in ManagementApiKeyEndpoints.cs):
//   - GET   /api/v1/management/api-keys             → ManagementApiKey[]
//   - POST  /api/v1/management/api-keys             → CreateApiKeyResponse (raw key ONCE)
//   - POST  /api/v1/management/api-keys/{id}/rotate → CreateApiKeyResponse (raw key ONCE)
//   - DELETE /api/v1/management/api-keys/{id}       → 204
//
// Raw key material is returned ONLY from create/rotate. List never exposes
// the plaintext; the UI's "copy key" reveal must therefore live on the
// mutation response, not on a refetch.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

// ─── Types ───────────────────────────────────────────────────────────────────

// Server response is the named `MgmtApiKeyDto` schema (openapi-response-adoption,
// Platform/ADR-0035). Shape is flat — platform-scope Management keys have no
// variable scope surface so there's no scope array on the list DTO.
//
// `lastUsedAt` was added by R5.2 PC.5 / B.12: the auth middleware stamps the
// column whenever a key authenticates successfully (debounced ≤ 1 write/min/
// key). `null` means the key has never been used since the column was added,
// or the row pre-dates migration 020.
export type ManagementApiKey = components['schemas']['MgmtApiKeyDto'];

export interface CreateApiKeyRequest {
  readonly name: string;
  /** Days until expiration; omit for a non-expiring key. */
  readonly expiresInDays?: number | null;
}

// `apiKey` is the plaintext key (prefix `mgmt_`). Returned ONLY on
// create/rotate — never on list. Named `CreateMgmtApiKeyResponse` schema
// (openapi-response-adoption, Platform/ADR-0035).
export type CreateApiKeyResponse = components['schemas']['CreateMgmtApiKeyResponse'];

// ─── Queries ─────────────────────────────────────────────────────────────────

const LIST_KEY = ['management', 'api-keys'] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () =>
      customFetch<ManagementApiKey[]>({
        url: '/api/v1/management/api-keys',
        method: 'GET',
      }),
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) =>
      customFetch<CreateApiKeyResponse>({
        url: '/api/v1/management/api-keys',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      // Intentionally NO success toast here — the page surfaces a one-time
      // reveal dialog that is a much stronger signal than a disposable toast.
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRotateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      customFetch<CreateApiKeyResponse>({
        url: `/api/v1/management/api-keys/${keyId}/rotate`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      // Same rationale as create — reveal dialog carries the success signal.
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (keyId: string) =>
      customFetch<void>({
        url: `/api/v1/management/api-keys/${keyId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success(t('toasts.apiKeys.revoked'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
