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
    saveCachedMessages('t1', 'v1', [msg('a'), msg('b')]);
    expect(loadCachedMessages('t1', 'v1')).toHaveLength(2);
  });

  it('Cap_KeepsLast100', () => {
    const arr = Array.from({ length: 150 }, (_, i) => msg(`m${i}`));
    saveCachedMessages('t1', 'v1', arr);
    const loaded = loadCachedMessages('t1', 'v1');
    expect(loaded).toHaveLength(100);
    expect(loaded[0]?.id).toBe('m50');
  });

  it('Empty_OnFirstLoad', () => {
    expect(loadCachedMessages('t1', 'v1')).toEqual([]);
  });

  it('IsolatedPerTenant', () => {
    saveCachedMessages('t1', 'v1', [msg('a')]);
    saveCachedMessages('t2', 'v1', [msg('b'), msg('c')]);
    expect(loadCachedMessages('t1', 'v1')).toHaveLength(1);
    expect(loadCachedMessages('t2', 'v1')).toHaveLength(2);
  });

  it('Load_ShouldNotReturnAnotherVisitorsMessages', () => {
    saveCachedMessages('t1', 'v1', [msg('a')]);
    expect(loadCachedMessages('t1', 'v2')).toEqual([]);
  });

  it('Load_ShouldNeverReadTheTenantOnlyEntry_AndDropIt', () => {
    localStorage.setItem('verbara-webchat-messages:t1', JSON.stringify([msg('old')]));
    expect(loadCachedMessages('t1', 'v1')).toEqual([]);
    expect(localStorage.getItem('verbara-webchat-messages:t1')).toBeNull();
  });

  it('Clear_ShouldRemoveEveryVisitorsEntryOfTheTenant_AndNoOtherTenants', () => {
    localStorage.setItem('verbara-webchat-messages:t1', '[]');
    saveCachedMessages('t1', 'v1', [msg('a')]);
    saveCachedMessages('t1', 'v2', [msg('b')]);
    saveCachedMessages('t10', 'v1', [msg('c')]);
    saveCachedMessages('t2', 'v1', [msg('d')]);

    clearCachedMessages('t1');

    expect(localStorage.getItem('verbara-webchat-messages:t1')).toBeNull();
    expect(loadCachedMessages('t1', 'v1')).toEqual([]);
    expect(loadCachedMessages('t1', 'v2')).toEqual([]);
    expect(loadCachedMessages('t10', 'v1')).toHaveLength(1);
    expect(loadCachedMessages('t2', 'v1')).toHaveLength(1);
  });

  it('Empty_OnCorruptedJson', () => {
    localStorage.setItem('verbara-webchat-messages:t1:v1', '{not-json');
    expect(loadCachedMessages('t1', 'v1')).toEqual([]);
  });

  it('Empty_WhenStorageIsUnavailable', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('denied');
    };
    try {
      expect(loadCachedMessages('t1', 'v1')).toEqual([]);
      expect(() => saveCachedMessages('t1', 'v1', [msg('a')])).not.toThrow();
      expect(() => clearCachedMessages('t1')).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
