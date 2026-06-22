import { z } from 'zod';
import type { LlmProviderType } from '@/core/api/hooks/use-typification-llm';

/**
 * Provider-settings field descriptor — drives the conditional fields rendered
 * per `providerType` (mirrors `channel-fields.ts`). `key` matches the
 * `LlmProviderSettings` member name; `labelKey` is an `admin:` i18n key.
 */
export interface FieldDef {
  /** Maps to a `LlmProviderSettings` member (baseUrl / azureDeployment / …). */
  key: 'baseUrl' | 'azureDeployment' | 'azureApiVersion' | 'anthropicVersion';
  labelKey: string;
  required: boolean;
}

/** Ordered, exhaustive provider list (drives the type Select). */
export const LLM_PROVIDERS = ['OpenAiCompatible', 'AzureOpenAi', 'Anthropic'] as const;

/**
 * Per-provider settings fields. The OpenAI-compatible provider needs a base
 * URL; Azure additionally needs deployment + api-version; Anthropic only an
 * optional pinned API version. `model` / `apiKey` / `enabled` are NOT here —
 * they are always present and handled by the form directly.
 */
export const llmProviderFields: Record<LlmProviderType, FieldDef[]> = {
  OpenAiCompatible: [
    { key: 'baseUrl', labelKey: 'admin:typification.llm.fields.baseUrl', required: true },
  ],
  AzureOpenAi: [
    { key: 'baseUrl', labelKey: 'admin:typification.llm.fields.baseUrl', required: true },
    {
      key: 'azureDeployment',
      labelKey: 'admin:typification.llm.fields.azureDeployment',
      required: true,
    },
    {
      key: 'azureApiVersion',
      labelKey: 'admin:typification.llm.fields.azureApiVersion',
      required: true,
    },
  ],
  Anthropic: [
    {
      key: 'anthropicVersion',
      labelKey: 'admin:typification.llm.fields.anthropicVersion',
      required: false,
    },
  ],
};

/**
 * Builds the Zod schema for a provider type. `model` is always required and
 * `apiKey` is an optional write-only field (empty preserves the stored key);
 * `enabled` is always present. Each provider's settings fields are added with
 * required/optional string validation. Validation messages are i18n keys.
 */
export function buildSchema(providerType: LlmProviderType) {
  const settingsShape: Record<string, z.ZodType> = {};
  for (const field of llmProviderFields[providerType]) {
    settingsShape[field.key] = field.required
      ? z.string().min(1, 'admin:typification.llm.validation.fieldRequired')
      : z.string();
  }
  return z.object({
    providerType: z.enum(LLM_PROVIDERS),
    model: z.string().min(1, 'admin:typification.llm.validation.modelRequired'),
    apiKey: z.string(),
    enabled: z.boolean(),
    ...settingsShape,
  });
}

/**
 * Default form values for a provider type. All settings fields start empty;
 * `apiKey` is always empty (write-only — never seeded from the masked config);
 * `enabled` defaults to `true` so a freshly-saved provider is active.
 */
export function buildDefaults(
  providerType: LlmProviderType,
): Record<string, string | boolean | LlmProviderType> {
  const defaults: Record<string, string | boolean | LlmProviderType> = {
    providerType,
    model: '',
    apiKey: '',
    enabled: true,
  };
  for (const field of llmProviderFields[providerType]) {
    defaults[field.key] = '';
  }
  return defaults;
}
