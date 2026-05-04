import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
  useAgentSkills,
  useAssignSkill,
  useRemoveAgentSkill,
  useAgentsWithSkill,
} from './use-skills';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleSkill = {
  name: 'voice',
  category: 'communication',
  description: 'Voice handling skill',
};

const sampleAssignment = {
  agentId: 'agent-1',
  skillName: 'voice',
  proficiency: 80,
};

describe('useSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch skills when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleSkill]);
    const { result } = renderHook(() => useSkills(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleSkill]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/skills',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useSkills(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useCreateSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleSkill);
    const { result } = renderHook(() => useCreateSkill(), { wrapper });
    act(() => {
      result.current.mutate(sampleSkill);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/skills',
      method: 'POST',
      data: sampleSkill,
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Conflict'));
    const { result } = renderHook(() => useCreateSkill(), { wrapper });
    act(() => {
      result.current.mutate(sampleSkill);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleSkill);
    const { result } = renderHook(() => useUpdateSkill(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'voice', category: 'updated', description: 'Updated skill' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/skills/voice',
      method: 'PUT',
      data: { category: 'updated', description: 'Updated skill' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useUpdateSkill(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'voice', category: 'x', description: 'x' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteSkill(), { wrapper });
    act(() => {
      result.current.mutate('voice');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/skills/voice',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteSkill(), { wrapper });
    act(() => {
      result.current.mutate('voice');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAgentSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch agent skills when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleAssignment]);
    const { result } = renderHook(() => useAgentSkills('agent-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleAssignment]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1/skills',
      method: 'GET',
    });
  });

  it('should not fetch when agentId is undefined', () => {
    const { result } = renderHook(() => useAgentSkills(undefined), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useAgentSkills('agent-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAssignSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssignSkill(), { wrapper });
    act(() => {
      result.current.mutate({ agentId: 'agent-1', skillName: 'voice', proficiency: 80 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1/skills',
      method: 'POST',
      data: { skillName: 'voice', proficiency: 80 },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useAssignSkill(), { wrapper });
    act(() => {
      result.current.mutate({ agentId: 'agent-1', skillName: 'voice', proficiency: 80 });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRemoveAgentSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveAgentSkill(), { wrapper });
    act(() => {
      result.current.mutate({ agentId: 'agent-1', skillName: 'voice' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/agents/agent-1/skills/voice',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useRemoveAgentSkill(), { wrapper });
    act(() => {
      result.current.mutate({ agentId: 'agent-1', skillName: 'voice' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAgentsWithSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch agents with skill when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleAssignment]);
    const { result } = renderHook(() => useAgentsWithSkill('voice'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleAssignment]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/skills/voice/agents',
      method: 'GET',
    });
  });

  it('should not fetch when skillName is undefined', () => {
    const { result } = renderHook(() => useAgentsWithSkill(undefined), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useAgentsWithSkill('voice'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
