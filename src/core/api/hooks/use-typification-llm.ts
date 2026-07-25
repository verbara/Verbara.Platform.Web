import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Per-tenant LLM config (Typification P2c.1) — BYO provider + encrypted key.
// Mirrors the Platform `/admin/ai/llm-config` contract (camelCase over the
// wire; the API key is NEVER returned — only `keySet` + `keyLast4`).
// ---------------------------------------------------------------------------

/** Wire values match the C# `AiSource` enum. */
export type AiSource = 'Byo' | 'PlatformManaged';

/** Wire values are PascalCase strings (match the C# `ProviderType` enum). */
export type LlmProviderType = 'OpenAiCompatible' | 'AzureOpenAi' | 'Anthropic';

/** Provider-specific connection settings; which members are used depends on
 *  the selected `providerType`. All optional on the wire. Members are
 *  `string | null` to stay structurally compatible with the generated
 *  `ProviderSettings` schema now reached via {@link TenantLlmConfig}.settings
 *  (openapi-response-adoption, Platform/ADR-0035) — the AOT contract emits each
 *  as `null | string`. */
export interface LlmProviderSettings {
  baseUrl?: string | null;
  azureDeployment?: string | null;
  azureApiVersion?: string | null;
  anthropicVersion?: string | null;
}

/** Masked GET/PUT response — the key is never echoed back; only `keySet`
 *  (whether a key is stored) + `keyLast4` (last 4 chars, or null).
 *  Server response is the named `TenantLlmConfigResponse` schema
 *  (openapi-response-adoption, Platform/ADR-0035). The generated DTO carries the
 *  same nine fields; its `providerType` / `settings` / `aiSource` resolve to the
 *  generated `ProviderType` / `ProviderSettings` / `AiSource` schemas, which are
 *  structurally identical to the local {@link LlmProviderType} / {@link
 *  LlmProviderSettings} / {@link AiSource} aliases those consumers still read. */
export type TenantLlmConfig = components['schemas']['TenantLlmConfigResponse'];

/**
 * The "no provider configured" state. A VALID, non-error mode — the tenant runs
 * deterministic typification (manual + cascading-form automation) with no LLM.
 * The GET endpoint returns this discriminated shape (`configured: false`)
 * instead of the masked config when nothing is stored.
 * `platformLlmAvailable` is included even in this empty shape so the UI can
 * offer the PlatformManaged option without a separate request.
 */
export interface LlmConfigEmpty {
  configured: false;
  platformLlmAvailable: boolean;
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
  aiSource: AiSource;
}

/** GET `/admin/ai/credits` response — platform-managed LLM usage summary. */
export interface AiCreditsResponse {
  allowanceCredits: number | null;
  consumedCredits: number;
  remainingCredits: number | null;
  usagePercent: number;
  periodEnd: string;
  actionOnExhaustion: string;
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

/**
 * Server response is the named `TestLlmConnectionResponse` schema
 * (openapi-response-adoption, Platform/ADR-0035). `latencyMs` is now single-typed
 * `number` on the regenerated document (openapi-numeric-schema-truth,
 * Platform/ADR-0036 strips the spurious AOT `string` arm at the source), so the
 * `LlmTestButton` interpolates/compares it directly. The former
 * `Omit & { latencyMs: number }` wrapper and its boundary coercion collapse to the
 * generated DTO.
 */
export type TestLlmConnectionResult = components['schemas']['TestLlmConnectionResponse'];

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
    mutationFn: (draft: TestLlmConnectionInput = {}): Promise<TestLlmConnectionResult> =>
      customFetch<components['schemas']['TestLlmConnectionResponse']>({
        url: '/api/v1/admin/ai/llm-config/test',
        method: 'POST',
        data: draft,
      }),
  });
}

/**
 * GET `/admin/ai/credits`. Platform-managed LLM usage summary for the current
 * tenant: allowance, consumed, remaining, period end, and exhaustion action.
 * Refreshes every 60 s (staleTime) — fine-grained enough for the settings UI.
 */
export function useAiCredits() {
  return useQuery({
    queryKey: ['typification', 'ai-credits'] as const,
    queryFn: () =>
      customFetch<AiCreditsResponse>({
        url: '/api/v1/admin/ai/credits',
        method: 'GET',
      }),
    staleTime: 60 * 1000,
  });
}
