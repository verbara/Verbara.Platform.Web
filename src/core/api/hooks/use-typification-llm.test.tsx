import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTenantLlmConfig,
  useUpsertTenantLlmConfig,
  useDeleteTenantLlmConfig,
  useTestLlmConnection,
  isLlmConfigEmpty,
  type TenantLlmConfig,
  type LlmConfigEmpty,
} from './use-typification-llm';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

// react-i18next: t returns the key (mutations toast via t(...)); no provider needed.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const maskedConfig: TenantLlmConfig = {
  providerType: 'OpenAiCompatible',
  model: 'gpt-4o-mini',
  settings: { baseUrl: 'https://api.openai.com/v1' },
  enabled: true,
  keySet: true,
  keyLast4: 'cdef',
  updatedAt: '2026-06-21T00:00:00Z',
};

describe('isLlmConfigEmpty', () => {
  it('isLlmConfigEmpty_ShouldReturnTrue_WhenConfiguredFalse', () => {
    const empty: LlmConfigEmpty = { configured: false };
    expect(isLlmConfigEmpty(empty)).toBe(true);
  });

  it('isLlmConfigEmpty_ShouldReturnFalse_WhenMaskedConfig', () => {
    expect(isLlmConfigEmpty(maskedConfig)).toBe(false);
  });
});

describe('useTenantLlmConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useTenantLlmConfig_ShouldFetchFromLlmConfigUrl_WhenCalled', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(maskedConfig);
    const { result } = renderHook(() => useTenantLlmConfig(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/ai/llm-config',
      method: 'GET',
    });
    expect(result.current.data).toEqual(maskedConfig);
  });

  it('useTenantLlmConfig_ShouldReturnEmptyState_WhenNoProviderConfigured', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ configured: false });
    const { result } = renderHook(() => useTenantLlmConfig(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The empty state is a VALID 200, discriminated by `configured: false`.
    expect(isLlmConfigEmpty(result.current.data!)).toBe(true);
  });
});

describe('useUpsertTenantLlmConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useUpsertTenantLlmConfig_ShouldPutWithKey_WhenApiKeyProvided', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(maskedConfig);
    const { result } = renderHook(() => useUpsertTenantLlmConfig(), { wrapper });
    result.current.mutate({
      providerType: 'OpenAiCompatible',
      model: 'gpt-4o-mini',
      apiKey: 'sk-secret-abcdef',
      settings: { baseUrl: 'https://api.openai.com/v1' },
      enabled: true,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/ai/llm-config',
      method: 'PUT',
      data: expect.objectContaining({ apiKey: 'sk-secret-abcdef', model: 'gpt-4o-mini' }),
    });
  });

  it('useUpsertTenantLlmConfig_ShouldSendNullKey_WhenPreservingStoredKey', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(maskedConfig);
    const { result } = renderHook(() => useUpsertTenantLlmConfig(), { wrapper });
    result.current.mutate({
      providerType: 'OpenAiCompatible',
      model: 'gpt-4o-mini',
      apiKey: null,
      settings: { baseUrl: 'https://api.openai.com/v1' },
      enabled: true,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = vi.mocked(client.customFetch).mock.calls[0][0];
    expect((call.data as { apiKey: string | null }).apiKey).toBeNull();
  });
});

describe('useDeleteTenantLlmConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useDeleteTenantLlmConfig_ShouldDeleteLlmConfig_WhenCalled', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteTenantLlmConfig(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/ai/llm-config',
      method: 'DELETE',
    });
  });
});

describe('useTestLlmConnection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useTestLlmConnection_ShouldPostEmptyDraft_WhenProbingSavedConfig', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      reachable: true,
      authOk: true,
      modelOk: true,
      latencyMs: 120,
      error: null,
    });
    const { result } = renderHook(() => useTestLlmConnection(), { wrapper });
    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/ai/llm-config/test',
      method: 'POST',
      data: {},
    });
    expect(result.current.data?.reachable).toBe(true);
  });

  it('useTestLlmConnection_ShouldPostDraft_WhenDraftFieldsProvided', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      reachable: false,
      authOk: false,
      modelOk: false,
      latencyMs: 0,
      error: 'unauthorized',
    });
    const { result } = renderHook(() => useTestLlmConnection(), { wrapper });
    result.current.mutate({ providerType: 'Anthropic', model: 'claude-3-5', apiKey: 'k' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/ai/llm-config/test',
      method: 'POST',
      data: { providerType: 'Anthropic', model: 'claude-3-5', apiKey: 'k' },
    });
    expect(result.current.data?.error).toBe('unauthorized');
  });
});
