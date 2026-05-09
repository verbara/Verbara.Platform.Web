import { describe, it, expect, beforeEach } from 'vitest';
import { loadCachedMessages, saveCachedMessages, clearCachedMessages } from './message-cache';
import type { ChatMessage } from './transport/session-api';

beforeEach(() => localStorage.clear());

const msg = (id: string): ChatMessage => ({
  id,
  text: id,
  from: 'visitor',
  timestamp: '2026-05-09T10:00:00Z',
});

describe('message-cache', () => {
  it('Save_AndLoad_Roundtrip', () => {
    saveCachedMessages('t1', [msg('a'), msg('b')]);
    expect(loadCachedMessages('t1')).toHaveLength(2);
  });

  it('Cap_KeepsLast100', () => {
    const arr = Array.from({ length: 150 }, (_, i) => msg(`m${i}`));
    saveCachedMessages('t1', arr);
    const loaded = loadCachedMessages('t1');
    expect(loaded).toHaveLength(100);
    expect(loaded[0]?.id).toBe('m50');
  });

  it('Empty_OnFirstLoad', () => {
    expect(loadCachedMessages('t1')).toEqual([]);
  });

  it('Clear_RemovesEntry', () => {
    saveCachedMessages('t1', [msg('a')]);
    clearCachedMessages('t1');
    expect(loadCachedMessages('t1')).toEqual([]);
  });

  it('IsolatedPerTenant', () => {
    saveCachedMessages('t1', [msg('a')]);
    saveCachedMessages('t2', [msg('b'), msg('c')]);
    expect(loadCachedMessages('t1')).toHaveLength(1);
    expect(loadCachedMessages('t2')).toHaveLength(2);
  });

  it('Empty_OnCorruptedJson', () => {
    localStorage.setItem('verbara-webchat-messages:t1', '{not-json');
    expect(loadCachedMessages('t1')).toEqual([]);
  });
});
