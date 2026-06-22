import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Per-tenant LLM config (Typification P2c.1) — BYO provider + encrypted key.
// Mirrors the Platform `/admin/ai/llm-config` contract (camelCase over the
// wire; the API key is NEVER returned — only `keySet` + `keyLast4`).
// ---------------------------------------------------------------------------

/** Wire values are PascalCase strings (match the C# `ProviderType` enum). */
export type LlmProviderType = 'OpenAiCompatible' | 'AzureOpenAi' | 'Anthropic';

/** Provider-specific connection settings; which members are used depends on
 *  the selected `providerType`. All optional on the wire. */
export interface LlmProviderSettings {
  baseUrl?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
  anthropicVersion?: string;
}

/** Masked GET/PUT response — the key is never echoed back; only `keySet`
 *  (whether a key is stored) + `keyLast4` (last 4 chars, or null). */
export interface TenantLlmConfig {
  providerType: LlmProviderType;
  model: string;
  settings: LlmProviderSettings;
  enabled: boolean;
  keySet: boolean;
  keyLast4: string | null;
  updatedAt: string;
}

/**
 * The "no provider configured" state. A VALID, non-error mode — the tenant runs
 * deterministic typification (manual + cascading-form automation) with no LLM.
 * The GET endpoint returns this discriminated shape (`configured: false`)
 * instead of the masked config when nothing is stored.
 */
export interface LlmConfigEmpty {
  configured: false;
}

export type TenantLlmConfigResult = TenantLlmConfig | LlmConfigEmpty;

/**
 * Narrowing type guard for the GET empty-vs-config discrimination. The empty
 * state carries `configured: false`; a real config never has a `configured`
 * member, so its presence is the discriminator.
 */
export function isLlmConfigEmpty(value: TenantLlmConfigResult): value is LlmConfigEmpty {
  return (value as LlmConfigEmpty).configured === false;
}

/**
 * PUT body. `apiKey` null/empty PRESERVES the stored key; a non-empty value
 * sets/rotates it (never send the masked placeholder). `settings` null clears
 * provider settings to defaults.
 */
export interface UpsertLlmConfigInput {
  providerType: LlmProviderType;
  model: string;
  apiKey: string | null;
  settings: LlmProviderSettings | null;
  enabled: boolean;
}

/**
 * Draft probe for POST `/test`. All fields optional: any field present →
 * probe the draft; `{}` → probe the saved config. NOT license-gated.
 */
export interface TestLlmConnectionInput {
  providerType?: LlmProviderType;
  model?: string;
  apiKey?: string | null;
  settings?: LlmProviderSettings | null;
}

export interface TestLlmConnectionResult {
  reachable: boolean;
  authOk: boolean;
  modelOk: boolean;
  latencyMs: number;
  error: string | null;
}

const LLM_CONFIG_KEY = ['typification', 'llm'] as const;

/**
 * GET `/admin/ai/llm-config`. Returns EITHER the masked config OR
 * `{ configured: false }` (a 200, not an error). Callers discriminate via
 * {@link isLlmConfigEmpty}.
 */
export function useTenantLlmConfig() {
  return useQuery({
    queryKey: LLM_CONFIG_KEY,
    queryFn: () =>
      customFetch<TenantLlmConfigResult>({
        url: '/api/v1/admin/ai/llm-config',
        method: 'GET',
      }),
  });
}

/** PUT `/admin/ai/llm-config` → masked config; invalidates the GET key. */
export function useUpsertTenantLlmConfig() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: UpsertLlmConfigInput) =>
      customFetch<TenantLlmConfig>({
        url: '/api/v1/admin/ai/llm-config',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LLM_CONFIG_KEY });
      toast.success(t('toasts.typification.llmConfigSaved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** DELETE `/admin/ai/llm-config` (204) → manual mode; invalidates the GET key. */
export function useDeleteTenantLlmConfig() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/admin/ai/llm-config',
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LLM_CONFIG_KEY });
      toast.success(t('toasts.typification.llmConfigDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * POST `/admin/ai/llm-config/test`. Accepts an optional draft (any field →
 * probe the draft; omit/`{}` → probe the saved config). Not gated; never 402.
 * Returns the structured probe result; the caller surfaces reachable/auth/model.
 */
export function useTestLlmConnection() {
  return useMutation({
    mutationFn: (draft: TestLlmConnectionInput = {}) =>
      customFetch<TestLlmConnectionResult>({
        url: '/api/v1/admin/ai/llm-config/test',
        method: 'POST',
        data: draft,
      }),
  });
}
