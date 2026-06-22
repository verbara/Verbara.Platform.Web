import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSchema, buildDefaults, llmProviderFields } from './llm-provider-fields';
import type { TenantLlmConfig } from '@/core/api/hooks/use-typification-llm';

const upsertMutate = vi.fn();

vi.mock('@/core/api/hooks/use-typification-llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-typification-llm')>();
  return {
    ...actual,
    useUpsertTenantLlmConfig: () => ({ mutate: upsertMutate, isPending: false }),
    useTestLlmConnection: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'last4' in opts ? `${key}:${opts.last4}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LlmConfigForm } from './llm-config-form';

const configuredOpenAi: TenantLlmConfig = {
  providerType: 'OpenAiCompatible',
  model: 'gpt-4o-mini',
  settings: { baseUrl: 'https://api.openai.com/v1' },
  enabled: true,
  keySet: true,
  keyLast4: 'cdef',
  updatedAt: '2026-06-21T00:00:00Z',
};

describe('llm-provider-fields helpers', () => {
  it('llmProviderFields_ShouldRequireBaseUrl_ForOpenAiCompatible', () => {
    const fields = llmProviderFields.OpenAiCompatible;
    expect(fields.map((f) => f.key)).toEqual(['baseUrl']);
    expect(fields[0].required).toBe(true);
  });

  it('llmProviderFields_ShouldRequireDeploymentAndVersion_ForAzure', () => {
    expect(llmProviderFields.AzureOpenAi.map((f) => f.key)).toEqual([
      'baseUrl',
      'azureDeployment',
      'azureApiVersion',
    ]);
    expect(llmProviderFields.AzureOpenAi.every((f) => f.required)).toBe(true);
  });

  it('llmProviderFields_ShouldHaveOptionalVersion_ForAnthropic', () => {
    expect(llmProviderFields.Anthropic.map((f) => f.key)).toEqual(['anthropicVersion']);
    expect(llmProviderFields.Anthropic[0].required).toBe(false);
  });

  it('buildSchema_ShouldRejectBlankModel_WhenModelEmpty', () => {
    const result = buildSchema('OpenAiCompatible').safeParse({
      providerType: 'OpenAiCompatible',
      model: '',
      apiKey: '',
      enabled: true,
      baseUrl: 'https://x',
    });
    expect(result.success).toBe(false);
  });

  it('buildDefaults_ShouldNotSeedApiKey_Always', () => {
    expect(buildDefaults('OpenAiCompatible').apiKey).toBe('');
  });
});

describe('LlmConfigForm masked key + conditional fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('LlmConfigForm_ShouldShowConfiguredBadgeAndMaskPlaceholder_WhenKeySet', () => {
    render(<LlmConfigForm config={configuredOpenAi} />);
    // Badge surfaces the last4; the input never echoes the key.
    expect(screen.getByTestId('llm-apiKey-badge').textContent).toContain('cdef');
    const apiKey = document.getElementById('llm-apiKey') as HTMLInputElement;
    expect(apiKey.type).toBe('password');
    expect(apiKey.getAttribute('autocomplete')).toBe('new-password');
    expect(apiKey.placeholder).toBe('••••••••');
    expect(apiKey.value).toBe('');
  });

  it('LlmConfigForm_ShouldRenderBaseUrlOnly_WhenOpenAiCompatible', () => {
    render(<LlmConfigForm config={configuredOpenAi} />);
    expect(document.getElementById('llm-baseUrl')).toBeInTheDocument();
    expect(document.getElementById('llm-azureDeployment')).not.toBeInTheDocument();
    expect(document.getElementById('llm-anthropicVersion')).not.toBeInTheDocument();
  });

  it('LlmConfigForm_ShouldRenderAzureFields_WhenAzureConfig', () => {
    const azure: TenantLlmConfig = {
      ...configuredOpenAi,
      providerType: 'AzureOpenAi',
      settings: {
        baseUrl: 'https://x.openai.azure.com',
        azureDeployment: 'gpt4o',
        azureApiVersion: '2024-08-01',
      },
    };
    render(<LlmConfigForm config={azure} />);
    expect(document.getElementById('llm-baseUrl')).toBeInTheDocument();
    expect(document.getElementById('llm-azureDeployment')).toBeInTheDocument();
    expect(document.getElementById('llm-azureApiVersion')).toBeInTheDocument();
  });

  it('LlmConfigForm_ShouldSendNullApiKey_WhenFieldLeftBlank', async () => {
    // The key is configured; leaving the field blank must PRESERVE it (send null).
    render(<LlmConfigForm config={configuredOpenAi} />);
    fireEvent.submit(screen.getByTestId('llm-config-form'));
    await waitFor(() => expect(upsertMutate).toHaveBeenCalled());
    const payload = upsertMutate.mock.calls[0][0] as { apiKey: string | null };
    expect(payload.apiKey).toBeNull();
  });

  it('LlmConfigForm_ShouldSendTypedApiKey_WhenFieldFilled', async () => {
    render(<LlmConfigForm config={configuredOpenAi} />);
    fireEvent.change(document.getElementById('llm-apiKey')!, {
      target: { value: 'sk-new-rotated-key' },
    });
    fireEvent.submit(screen.getByTestId('llm-config-form'));
    await waitFor(() => expect(upsertMutate).toHaveBeenCalled());
    const payload = upsertMutate.mock.calls[0][0] as { apiKey: string | null };
    expect(payload.apiKey).toBe('sk-new-rotated-key');
  });

  it('LlmConfigForm_ShouldRenderManualModeNote_Always', () => {
    render(<LlmConfigForm config={null} />);
    expect(screen.getByTestId('llm-manual-mode-note')).toBeInTheDocument();
  });
});
