import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAgents,
  useAgent,
  useAgentMe,
  useCreateAgent,
  useUpdateAgent,
  useDeleteAgent,
  useForceOffline,
  useUpdateAgentState,
  useUpdateAgentStateAdmin,
} from './use-agents';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleAgent = {
  agentId: 'agent-1',
  id: 'agent-1',
  userId: 'user-1',
  displayName: 'Agent One',
  state: 'Available',
  skills: ['voice', 'chat'],
  extension: '1001',
  teamId: 'team-1',
  teamName: 'Support',
  userEmail: 'agent@example.com',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch agents when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      items: [sampleAgent],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { ...sampleAgent, id: 'agent-1', skills: ['voice', 'chat'] },
    ]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents',
      method: 'GET',
      params: { page: '1', pageSize: '100' },
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch agent by id when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleAgent);
    const { result } = renderHook(() => useAgent('agent-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      ...sampleAgent,
      id: 'agent-1',
      skills: ['voice', 'chat'],
    });
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1',
      method: 'GET',
    });
  });

  it('should surface effectiveCapacity and capacityOverride from the DTO', async () => {
    const agentWithCapacity = {
      ...sampleAgent,
      effectiveCapacity: { maxVoice: 1, maxChat: 5, maxEmail: 5, maxSms: 3, maxTotal: 10 },
      capacityOverride: {
        maxVoice: null,
        maxChat: 5,
        maxEmail: null,
        maxSms: null,
        maxTotal: null,
      },
    };
    vi.mocked(client.customFetch).mockResolvedValue(agentWithCapacity);
    const { result } = renderHook(() => useAgent('agent-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.effectiveCapacity).toEqual({
      maxVoice: 1,
      maxChat: 5,
      maxEmail: 5,
      maxSms: 3,
      maxTotal: 10,
    });
    expect(result.current.data?.capacityOverride).toEqual({
      maxVoice: null,
      maxChat: 5,
      maxEmail: null,
      maxSms: null,
      maxTotal: null,
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useAgent(undefined), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useAgent('agent-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAgentMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch current agent when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleAgent);
    const { result } = renderHook(() => useAgentMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleAgent);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/agents/me',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Unauthorized'));
    const { result } = renderHook(() => useAgentMe(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleAgent);
    const { result } = renderHook(() => useCreateAgent(), { wrapper });
    act(() => {
      result.current.mutate({ userId: 'user-1', displayName: 'Agent One' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents',
      method: 'POST',
      data: { userId: 'user-1', displayName: 'Agent One' },
    });
  });

  it('should send capacity override in the body when provided', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleAgent);
    const { result } = renderHook(() => useCreateAgent(), { wrapper });
    act(() => {
      result.current.mutate({
        userId: 'user-1',
        displayName: 'Agent One',
        capacity: { maxVoice: 1, maxChat: 5, maxEmail: null, maxSms: null, maxTotal: null },
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents',
      method: 'POST',
      data: {
        userId: 'user-1',
        displayName: 'Agent One',
        capacity: { maxVoice: 1, maxChat: 5, maxEmail: null, maxSms: null, maxTotal: null },
      },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Conflict'));
    const { result } = renderHook(() => useCreateAgent(), { wrapper });
    act(() => {
      result.current.mutate({ userId: 'user-1', displayName: 'Agent One' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleAgent);
    const { result } = renderHook(() => useUpdateAgent(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'agent-1', displayName: 'Updated Agent' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1',
      method: 'PUT',
      data: { displayName: 'Updated Agent' },
    });
  });

  it('should include capacity override in the PUT body when provided', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleAgent);
    const { result } = renderHook(() => useUpdateAgent(), { wrapper });
    act(() => {
      result.current.mutate({
        id: 'agent-1',
        capacity: { maxVoice: null, maxChat: 3, maxEmail: 10, maxSms: null, maxTotal: 12 },
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1',
      method: 'PUT',
      data: { capacity: { maxVoice: null, maxChat: 3, maxEmail: 10, maxSms: null, maxTotal: 12 } },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useUpdateAgent(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'agent-1', displayName: 'Updated Agent' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteAgent(), { wrapper });
    act(() => {
      result.current.mutate('agent-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteAgent(), { wrapper });
    act(() => {
      result.current.mutate('agent-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useForceOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST { revokeSessions: true } to the force-offline endpoint when the toggle is on', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useForceOffline(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'agent-1', revokeSessions: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1/force-offline',
      method: 'POST',
      data: { revokeSessions: true },
    });
  });

  it('should POST { revokeSessions: false } when the toggle is off', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useForceOffline(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'agent-1', revokeSessions: false });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1/force-offline',
      method: 'POST',
      data: { revokeSessions: false },
    });
  });

  it('should invalidate both the agents list and the agent detail on success', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useForceOffline(), { wrapper: localWrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'agent-1', revokeSessions: true });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['agents'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['agents', 'agent-1'] });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useForceOffline(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'agent-1', revokeSessions: true });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateAgentState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUpdateAgentState(), { wrapper });
    act(() => {
      result.current.mutate({ state: 'Away' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/agents/me/state',
      method: 'PUT',
      data: { state: 'Away' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Invalid state'));
    const { result } = renderHook(() => useUpdateAgentState(), { wrapper });
    act(() => {
      result.current.mutate({ state: 'InvalidState' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateAgentStateAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUpdateAgentStateAdmin(), { wrapper });
    act(() => {
      result.current.mutate({ agentId: 'agent-1', state: 'Offline' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1',
      method: 'PUT',
      data: { status: 'Offline' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Agent not found'));
    const { result } = renderHook(() => useUpdateAgentStateAdmin(), { wrapper });
    act(() => {
      result.current.mutate({ agentId: 'agent-1', state: 'Offline' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
