import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAgentAssistConfig,
  useUpdateAgentAssistConfig,
  useKeywordRules,
  useUpdateKeywordRules,
  useComplianceRules,
  useUpdateComplianceRules,
} from './use-agent-assist';
import type { AgentAssistConfig, KeywordRule, ComplianceRule } from './use-agent-assist';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleConfig: AgentAssistConfig = {
  enabled: true,
  suggestionTimeoutMs: 5000,
  sentimentTimeoutMs: 3000,
  complianceTimeoutMs: 2000,
  queueNames: ['Support', 'Sales'],
  samplingRate: 0.5,
};

const sampleKeywordRule: KeywordRule = {
  id: 'rule-1',
  keyword: 'cancel',
  suggestionText: 'Offer retention',
  priority: 'Important',
  isActive: true,
};

const sampleComplianceRule: ComplianceRule = {
  ruleId: 'cr-1',
  pattern: '\\b(credit card)\\b',
  severity: 'Critical',
  action: 'Block',
  description: 'Block credit card numbers',
};

describe('useAgentAssistConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch agent assist config', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleConfig);
    const { result } = renderHook(() => useAgentAssistConfig(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleConfig);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agent-assist/config',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useAgentAssistConfig(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Fetch failed');
  });
});

describe('useUpdateAgentAssistConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update agent assist config', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleConfig);
    const { result } = renderHook(() => useUpdateAgentAssistConfig(), { wrapper });
    act(() => {
      result.current.mutate({ enabled: false, samplingRate: 0.8 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agent-assist/config',
      method: 'PUT',
      data: { enabled: false, samplingRate: 0.8 },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdateAgentAssistConfig(), { wrapper });
    act(() => {
      result.current.mutate({ enabled: true });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useKeywordRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch keyword rules', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleKeywordRule]);
    const { result } = renderHook(() => useKeywordRules(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleKeywordRule]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agent-assist/keyword-rules',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useKeywordRules(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateKeywordRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update keyword rules', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleKeywordRule]);
    const { result } = renderHook(() => useUpdateKeywordRules(), { wrapper });
    act(() => {
      result.current.mutate([sampleKeywordRule]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agent-assist/keyword-rules',
      method: 'PUT',
      data: [sampleKeywordRule],
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdateKeywordRules(), { wrapper });
    act(() => {
      result.current.mutate([sampleKeywordRule]);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useComplianceRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch compliance rules', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleComplianceRule]);
    const { result } = renderHook(() => useComplianceRules(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleComplianceRule]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agent-assist/compliance-rules',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useComplianceRules(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateComplianceRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update compliance rules', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleComplianceRule]);
    const { result } = renderHook(() => useUpdateComplianceRules(), { wrapper });
    act(() => {
      result.current.mutate([sampleComplianceRule]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agent-assist/compliance-rules',
      method: 'PUT',
      data: [sampleComplianceRule],
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Update failed'));
    const { result } = renderHook(() => useUpdateComplianceRules(), { wrapper });
    act(() => {
      result.current.mutate([sampleComplianceRule]);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
