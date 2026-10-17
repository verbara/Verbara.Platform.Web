import { describe, it, expect, beforeEach } from 'vitest';
import {
  SESSION_TIMEOUT_MS,
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  touchStoredSession,
  type StoredSession,
} from './session-store';

const NOW = 1_800_000_000_000;

const session: StoredSession = {
  sessionId: 's1',
  wsUrl: 'wss://x/ws/webchat/s1',
  visitorId: 'v1',
  createdAt: NOW - 60_000,
  lastActiveAt: NOW - 60_000,
};

beforeEach(() => {
  localStorage.clear();
});

describe('session-store', () => {
  it('LoadStoredSession_ReturnsSession_WhenSameVisitorAndRecentlyActive', () => {
    saveStoredSession('t1', session);
    expect(loadStoredSession('t1', 'v1', NOW)).toEqual(session);
  });

  it('LoadStoredSession_ReturnsNull_WhenIdleForSessionTimeout', () => {
    saveStoredSession('t1', { ...session, lastActiveAt: NOW - SESSION_TIMEOUT_MS });
    expect(loadStoredSession('t1', 'v1', NOW)).toBeNull();
  });

  it('LoadStoredSession_ReturnsSession_WhenOldButRecentlyActive', () => {
    saveStoredSession('t1', { ...session, createdAt: NOW - 3 * SESSION_TIMEOUT_MS });
    expect(loadStoredSession('t1', 'v1', NOW)?.sessionId).toBe('s1');
  });

  it('LoadStoredSession_ReturnsNull_WhenAnotherVisitorOrTenant', () => {
    saveStoredSession('t1', session);
    expect(loadStoredSession('t1', 'v2', NOW)).toBeNull();
    expect(loadStoredSession('t2', 'v1', NOW)).toBeNull();
  });

  it('LoadStoredSession_ReturnsNull_WhenEntryIsMalformed', () => {
    localStorage.setItem('verbara-webchat-session:t1', '{not json');
    expect(loadStoredSession('t1', 'v1', NOW)).toBeNull();
    localStorage.setItem('verbara-webchat-session:t1', JSON.stringify({ sessionId: 's1' }));
    expect(loadStoredSession('t1', 'v1', NOW)).toBeNull();
  });

  it('TouchStoredSession_MovesLastActive_OnlyForThatSession', () => {
    saveStoredSession('t1', session);
    touchStoredSession('t1', 'other', NOW);
    expect(loadStoredSession('t1', 'v1', NOW)?.lastActiveAt).toBe(session.lastActiveAt);

    touchStoredSession('t1', 's1', NOW);
    expect(loadStoredSession('t1', 'v1', NOW)?.lastActiveAt).toBe(NOW);
  });

  it('ClearStoredSession_ForgetsSession', () => {
    saveStoredSession('t1', session);
    clearStoredSession('t1');
    expect(loadStoredSession('t1', 'v1', NOW)).toBeNull();
  });
});
