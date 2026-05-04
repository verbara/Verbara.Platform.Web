import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useClusterStatus,
  useClusterNodes,
  useClusterInstances,
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
  useDrainNode,
  useCancelDrain,
  useForceDrain,
  type ClusterStatus,
  type ClusterNode,
  type ClusterInstance,
  type DrainStatus,
} from './use-cluster';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleNode: ClusterNode = {
  nodeId: 'node-1',
  state: 'active',
  weight: 100,
  priorityTier: 1,
  maxCapacity: 500,
};

const sampleStatus: ClusterStatus = {
  instanceId: 'inst-1',
  nodes: [sampleNode],
  totalChannels: 10,
  totalAgents: 5,
  activeDrains: [],
  instances: [],
};

const sampleInstance: ClusterInstance = {
  instanceId: 'inst-1',
  startedAt: '2026-01-01T00:00:00Z',
  lastSeen: '2026-01-01T01:00:00Z',
  ownedNodes: ['node-1'],
  activeChannels: 10,
};

const sampleDrain: DrainStatus = {
  nodeId: 'node-1',
  state: 'draining',
  startedAt: '2026-01-01T00:00:00Z',
  deadline: '2026-01-01T01:00:00Z',
  initialCallCount: 10,
  remainingCallCount: 5,
  naturallyCompleted: 4,
  forceDisconnected: 1,
};

describe('useClusterStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch cluster status when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleStatus);
    const { result } = renderHook(() => useClusterStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleStatus);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/status',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useClusterStatus(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useClusterNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch cluster nodes when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleNode]);
    const { result } = renderHook(() => useClusterNodes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleNode]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/nodes',
      method: 'GET',
    });
  });
});

describe('useClusterInstances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch cluster instances when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleInstance]);
    const { result } = renderHook(() => useClusterInstances(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleInstance]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/instances',
      method: 'GET',
    });
  });
});

describe('useCreateNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleNode);
    const { result } = renderHook(() => useCreateNode(), { wrapper });
    act(() => {
      result.current.mutate({
        nodeId: 'node-1',
        amiHostname: 'h1',
        amiPort: 5038,
        amiUsername: 'u',
        amiPassword: 'p',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/nodes',
      method: 'POST',
      data: {
        nodeId: 'node-1',
        amiHostname: 'h1',
        amiPort: 5038,
        amiUsername: 'u',
        amiPassword: 'p',
      },
    });
  });
});

describe('useUpdateNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleNode);
    const { result } = renderHook(() => useUpdateNode(), { wrapper });
    act(() => {
      result.current.mutate({ nodeId: 'node-1', weight: 200 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/nodes/node-1',
      method: 'PUT',
      data: { weight: 200 },
    });
  });
});

describe('useDeleteNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteNode(), { wrapper });
    act(() => {
      result.current.mutate('node-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/nodes/node-1',
      method: 'DELETE',
    });
  });
});

describe('useDrainNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call drain endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleDrain);
    const { result } = renderHook(() => useDrainNode(), { wrapper });
    act(() => {
      result.current.mutate({ nodeId: 'node-1', gracePeriodSeconds: 300 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/nodes/node-1/drain',
      method: 'POST',
      data: { gracePeriodSeconds: 300 },
    });
  });
});

describe('useCancelDrain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call cancel drain endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCancelDrain(), { wrapper });
    act(() => {
      result.current.mutate('node-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/nodes/node-1/drain',
      method: 'DELETE',
    });
  });
});

describe('useForceDrain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call force drain endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleDrain);
    const { result } = renderHook(() => useForceDrain(), { wrapper });
    act(() => {
      result.current.mutate('node-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/cluster/nodes/node-1/force-drain',
      method: 'POST',
    });
  });
});
