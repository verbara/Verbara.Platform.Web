import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { FlowDefinition, FlowNodeDto } from './use-flows';
import { useFlows, useFlow, useCreateFlow, useUpdateFlow, usePublishFlow } from './use-flows';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockNode: FlowNodeDto = {
  nodeId: 'n1',
  type: 'greeting',
  config: { message: 'Hello' },
  edges: [{ condition: 'default', targetNodeId: 'n2' }],
};

const mockFlow: FlowDefinition = {
  flowId: 'f1',
  name: 'Welcome Flow',
  version: 1,
  isPublished: false,
  updatedAt: '2026-01-02T00:00:00Z',
  nodes: [mockNode],
};

describe('useFlows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all flows', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockFlow]);

    const { result } = renderHook(() => useFlows(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockFlow]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/flows',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useFlows(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single flow by id', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockFlow);

    const { result } = renderHook(() => useFlow('f1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockFlow);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/flows/f1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useFlow(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useFlow('bad-id'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/admin/flows', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockFlow);

    const { result } = renderHook(() => useCreateFlow(), { wrapper });

    const data = { name: 'Welcome Flow', entryNodeId: 'n1', nodes: [mockNode] };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/flows',
      method: 'POST',
      data,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation error'));

    const { result } = renderHook(() => useCreateFlow(), { wrapper });

    act(() => {
      result.current.mutate({ name: '', entryNodeId: '', nodes: [] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call PUT /api/v1/admin/flows/{id}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockFlow);

    const { result } = renderHook(() => useUpdateFlow(), { wrapper });

    const data = { id: 'f1', name: 'Updated Flow', nodes: [mockNode] };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/flows/f1',
      method: 'PUT',
      data: { name: 'Updated Flow', nodes: [mockNode] },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useUpdateFlow(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'bad' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePublishFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/admin/flows/{id}/publish', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => usePublishFlow(), { wrapper });

    act(() => {
      result.current.mutate('f1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/flows/f1/publish',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Cannot publish'));

    const { result } = renderHook(() => usePublishFlow(), { wrapper });

    act(() => {
      result.current.mutate('f1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
