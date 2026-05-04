import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAgentAssistFeature, useUpdateAgentAssistFeature } from './use-agent-assist-feature';
import type { AgentAssistFeature, AgentAssistFeatureUpdate } from './use-agent-assist-feature';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleFeature: AgentAssistFeature = {
  enabled: true,
  provider: 'deepgram',
  credentialsConfigured: true,
  apiKeyMasked: 'dk_***abc',
  endpointMasked: 'https://***',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'admin',
};

describe('useAgentAssistFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch agent assist feature status', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleFeature);
    const { result } = renderHook(() => useAgentAssistFeature(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleFeature);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/features/agent-assist',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useAgentAssistFeature(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Fetch failed');
  });
});

describe('useUpdateAgentAssistFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update agent assist feature', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleFeature);
    const update: AgentAssistFeatureUpdate = {
      enabled: true,
      provider: 'whisper',
      credentials: { apiKey: 'new-key', endpoint: 'https://new-endpoint' },
    };
    const { result } = renderHook(() => useUpdateAgentAssistFeature(), { wrapper });
    act(() => {
      result.current.mutate(update);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/features/agent-assist',
      method: 'PUT',
      data: update,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const update: AgentAssistFeatureUpdate = {
      enabled: false,
      provider: null,
      credentials: null,
    };
    const { result } = renderHook(() => useUpdateAgentAssistFeature(), { wrapper });
    act(() => {
      result.current.mutate(update);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
