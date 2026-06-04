import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import { safeAgentTeardown } from './agent-teardown';
import type { Agent } from '@/core/api/hooks/use-agents';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

// Fixtures use the REAL PascalCase `/agents/me` wire casing on purpose
// (`AgentState` enum names: Available, Busy, DND, …) so the suite guards the
// actual contract — these pass WITH the .toLowerCase() normalization and would
// FAIL without it (a literal `has("Busy")` against the lowercase set is false).
function makeAgent(state: string): Agent {
  return {
    agentId: 'a1',
    id: 'a1',
    userId: 'u1',
    displayName: 'Agent One',
    state,
    skills: [],
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

describe('safeAgentTeardown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('SafeAgentTeardown_ShouldPutOffline_WhenAgentRoutable', async () => {
    const qc = newQueryClient();
    qc.setQueryData<Agent>(['agent-me'], makeAgent('Busy'));
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    await safeAgentTeardown(qc);

    expect(client.customFetch).toHaveBeenCalledTimes(1);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/agents/me/state',
      method: 'PUT',
      data: { state: 'offline' },
    });
  });

  it('SafeAgentTeardown_ShouldPutOffline_WhenAgentAvailable', async () => {
    const qc = newQueryClient();
    qc.setQueryData<Agent>(['agent-me'], makeAgent('Available'));
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    await safeAgentTeardown(qc);

    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/agents/me/state',
      method: 'PUT',
      data: { state: 'offline' },
    });
  });

  it('SafeAgentTeardown_ShouldNotPut_WhenAgentDeliberatelyNonRoutable', async () => {
    const qc = newQueryClient();
    qc.setQueryData<Agent>(['agent-me'], makeAgent('DND'));

    await safeAgentTeardown(qc);

    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('SafeAgentTeardown_ShouldNotPut_WhenNoAgentMeData', async () => {
    const qc = newQueryClient();

    await safeAgentTeardown(qc);

    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('SafeAgentTeardown_ShouldResolve_WhenPutRejects', async () => {
    const qc = newQueryClient();
    qc.setQueryData<Agent>(['agent-me'], makeAgent('Busy'));
    vi.mocked(client.customFetch).mockRejectedValue(new Error('network down'));

    await expect(safeAgentTeardown(qc)).resolves.toBeUndefined();
    expect(client.customFetch).toHaveBeenCalledTimes(1);
  });

  it('SafeAgentTeardown_ShouldResolveAtCap_WhenPutHangs', async () => {
    vi.useFakeTimers();
    const qc = newQueryClient();
    qc.setQueryData<Agent>(['agent-me'], makeAgent('Available'));
    // A PUT that never settles — the 1.5s cap must let teardown resolve anyway.
    vi.mocked(client.customFetch).mockReturnValue(new Promise<void>(() => {}));

    const teardown = safeAgentTeardown(qc);
    let resolved = false;
    void teardown.then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(1_500);
    await teardown;
    expect(resolved).toBe(true);
  });
});
