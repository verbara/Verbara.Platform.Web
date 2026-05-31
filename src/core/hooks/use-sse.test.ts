import { describe, it, expect } from 'vitest';
import { isForCurrentAgent } from './use-sse';

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
