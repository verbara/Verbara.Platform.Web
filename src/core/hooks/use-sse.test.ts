import { describe, it, expect } from 'vitest';
import { isForCurrentAgent, resolveAgentId } from './use-sse';

describe('resolveAgentId', () => {
  it('reads agentId — the shape /agents/me actually returns', () => {
    // Regression: GET /agents/me serializes the raw Agent as `agentId`, not `id`.
    // Reading only `.id` left currentAgentId() undefined and dropped every offer.
    expect(resolveAgentId({ agentId: 'agent-786d14bb' })).toBe('agent-786d14bb');
  });

  it('falls back to id when agentId is absent (normalized hooks)', () => {
    expect(resolveAgentId({ id: 'agent-786d14bb' })).toBe('agent-786d14bb');
  });

  it('prefers agentId over id when both present', () => {
    expect(resolveAgentId({ agentId: 'real', id: 'other' })).toBe('real');
  });

  it('returns undefined when nothing is cached (admin / not loaded yet)', () => {
    expect(resolveAgentId(undefined)).toBeUndefined();
    expect(resolveAgentId({})).toBeUndefined();
  });
});

describe('isForCurrentAgent', () => {
  it('returns true when the event agentId equals my agentId', () => {
    expect(isForCurrentAgent('agent-40ccd6', 'agent-40ccd6')).toBe(true);
  });

  it('returns false when the event targets a different agent', () => {
    expect(isForCurrentAgent('agent-40ccd6', 'agent-99999')).toBe(false);
  });

  it('returns false when my agentId is unknown (no agent profile loaded / admin)', () => {
    expect(isForCurrentAgent('agent-40ccd6', undefined)).toBe(false);
  });

  it('does NOT match the user id — AgentId and UserId are distinct entities', () => {
    // Regression: the offered/assigned events carry Agent.AgentId, which is a
    // different EntityId from the logged-in User.UserId. Matching the event
    // agentId against the user id silently suppressed every agent-targeted
    // notification (the WebChat offer card never appeared).
    const myUserId = 'user-a8f74';
    const myAgentId = 'agent-40ccd6';
    const eventAgentId = 'agent-40ccd6';
    expect(isForCurrentAgent(eventAgentId, myUserId)).toBe(false);
    expect(isForCurrentAgent(eventAgentId, myAgentId)).toBe(true);
  });
});
