import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import { useApiKeys, useCreateApiKey, useRotateApiKey, useRevokeApiKey } from './use-api-keys';
import type { ManagementApiKey, CreateApiKeyResponse } from './use-api-keys';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockApiKey: ManagementApiKey = {
  keyId: 'k1',
  name: 'Test Key',
  isRevoked: false,
  expiresAt: '2027-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  lastUsedAt: null,
};

const mockCreateResponse: CreateApiKeyResponse = {
  keyId: 'k1',
  name: 'Test Key',
  apiKey: 'mgmt_abc123',
  expiresAt: '2027-01-01T00:00:00Z',
};

describe('useApiKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch api keys', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockApiKey]);
    const { result } = renderHook(() => useApiKeys(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockApiKey]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/api-keys',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useApiKeys(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an api key', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockCreateResponse);
    const { result } = renderHook(() => useCreateApiKey(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Test Key', expiresInDays: 365 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCreateResponse);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/api-keys',
      method: 'POST',
      data: { name: 'Test Key', expiresInDays: 365 },
    });
  });

  it('should handle error when creation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useCreateApiKey(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'X' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRotateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rotate an api key', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockCreateResponse);
    const { result } = renderHook(() => useRotateApiKey(), { wrapper });
    act(() => {
      result.current.mutate('k1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCreateResponse);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/api-keys/k1/rotate',
      method: 'POST',
    });
  });

  it('should handle error when rotation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRotateApiKey(), { wrapper });
    act(() => {
      result.current.mutate('k1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRevokeApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should revoke an api key', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRevokeApiKey(), { wrapper });
    act(() => {
      result.current.mutate('k1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/api-keys/k1',
      method: 'DELETE',
    });
  });

  it('should handle error when revocation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRevokeApiKey(), { wrapper });
    act(() => {
      result.current.mutate('k1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
