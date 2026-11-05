import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearTenantQueues, createOfflineQueue, settleVisitorQueues } from './offline-queue';

const KEY = (tenant: string, visitor: string) => `verbara-webchat-queue:${tenant}:${visitor}`;
const OLD_KEY = (tenant: string) => `verbara-webchat-queue:${tenant}`;
const queued = (id: string) =>
  JSON.stringify([{ id, text: id, timestamp: '2026-05-09T10:00:00Z' }]);

beforeEach(() => {
  localStorage.clear();
});

describe('offline-queue', () => {
  it('Push_PersistsToLocalStorage_UnderTheTenantAndTheVisitor', () => {
    const q = createOfflineQueue('tenant-1', 'visitor-1');
    q.push({ id: 'm1', text: 'hi', timestamp: '2026-05-09T10:00:00Z' });
    expect(localStorage.getItem(KEY('tenant-1', 'visitor-1'))).toContain('m1');
    expect(localStorage.getItem(OLD_KEY('tenant-1'))).toBeNull();
  });

  it('Drain_ReturnsAllItems_AndClears', () => {
    const q = createOfflineQueue('tenant-1', 'visitor-1');
    q.push({ id: 'm1', text: 'a', timestamp: '2026-05-09T10:00:00Z' });
    q.push({ id: 'm2', text: 'b', timestamp: '2026-05-09T10:00:01Z' });
    const items = q.drain();
    expect(items).toHaveLength(2);
    expect(q.size()).toBe(0);
  });

  it('Persist_AcrossInstances', () => {
    const q1 = createOfflineQueue('tenant-1', 'visitor-1');
    q1.push({ id: 'm1', text: 'hi', timestamp: '2026-05-09T10:00:00Z' });
    const q2 = createOfflineQueue('tenant-1', 'visitor-1');
    expect(q2.size()).toBe(1);
  });

  it('Cap_LimitsToMaxItems_DropsOldest', () => {
    const q = createOfflineQueue('tenant-1', 'visitor-1', { maxItems: 3 });
    for (let i = 0; i < 5; i++) {
      q.push({ id: `m${i}`, text: String(i), timestamp: '2026-05-09T10:00:00Z' });
    }
    const items = q.drain();
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.id)).toEqual(['m2', 'm3', 'm4']);
  });

  it('Queue_ShouldNotReadAnotherVisitorsMessages_WhenTheTenantIsTheSame', () => {
    localStorage.setItem(KEY('t1', 'visitor-a'), queued('from-a'));
    const queueOfB = createOfflineQueue('t1', 'visitor-b');
    expect(queueOfB.size()).toBe(0);
    expect(queueOfB.drain()).toEqual([]);
    expect(localStorage.getItem(KEY('t1', 'visitor-a'))).not.toBeNull();
  });

  it('Queue_ShouldNotReadTheOldKey_WhenItHoldsMessages', () => {
    localStorage.setItem(OLD_KEY('t1'), queued('old'));
    expect(createOfflineQueue('t1', 'visitor-a').drain()).toEqual([]);
  });

  it('Clear_ShouldClearOnlyThisVisitorsQueue', () => {
    localStorage.setItem(KEY('t1', 'visitor-a'), queued('from-a'));
    localStorage.setItem(KEY('t1', 'visitor-b'), queued('from-b'));
    createOfflineQueue('t1', 'visitor-b').clear();
    expect(localStorage.getItem(KEY('t1', 'visitor-b'))).toBeNull();
    expect(localStorage.getItem(KEY('t1', 'visitor-a'))).not.toBeNull();
  });
});

describe('settleVisitorQueues', () => {
  it('SettleVisitorQueues_ShouldDeleteOtherVisitorsQueues_AndKeepThisVisitors', () => {
    localStorage.setItem(KEY('t1', 'visitor-a'), queued('from-a'));
    localStorage.setItem(KEY('t1', 'visitor-c'), queued('from-c'));
    localStorage.setItem(KEY('t1', 'visitor-b'), queued('from-b'));

    settleVisitorQueues('t1', 'visitor-b');

    expect(localStorage.getItem(KEY('t1', 'visitor-a'))).toBeNull();
    expect(localStorage.getItem(KEY('t1', 'visitor-c'))).toBeNull();
    expect(localStorage.getItem(KEY('t1', 'visitor-b'))).toBe(queued('from-b'));
  });

  it('SettleVisitorQueues_ShouldRemoveTheOldKeyUnread', () => {
    localStorage.setItem(OLD_KEY('t1'), queued('old'));
    const read = vi.spyOn(Storage.prototype, 'getItem');

    settleVisitorQueues('t1', 'visitor-b');

    expect(read).not.toHaveBeenCalledWith(OLD_KEY('t1'));
    read.mockRestore();
    expect(localStorage.getItem(OLD_KEY('t1'))).toBeNull();
  });

  it('SettleVisitorQueues_ShouldKeepAnotherTenantsQueues_WhenItsIdStartsWithThisTenants', () => {
    localStorage.setItem(KEY('t1', 'visitor-a'), queued('from-a'));
    localStorage.setItem(OLD_KEY('t10'), queued('old-of-t10'));
    localStorage.setItem(KEY('t10', 'visitor-a'), queued('of-t10'));
    localStorage.setItem(KEY('t2', 'visitor-a'), queued('of-t2'));

    settleVisitorQueues('t1', 'visitor-b');

    expect(localStorage.getItem(KEY('t1', 'visitor-a'))).toBeNull();
    expect(localStorage.getItem(OLD_KEY('t10'))).toBe(queued('old-of-t10'));
    expect(localStorage.getItem(KEY('t10', 'visitor-a'))).toBe(queued('of-t10'));
    expect(localStorage.getItem(KEY('t2', 'visitor-a'))).toBe(queued('of-t2'));
  });

  it('SettleVisitorQueues_ShouldNotThrow_WhenStorageIsUnavailable', () => {
    const key = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => settleVisitorQueues('t1', 'visitor-b')).not.toThrow();
    key.mockRestore();
  });
});

describe('clearTenantQueues', () => {
  it('ClearTenantQueues_ShouldClearEveryQueueOfTheTenant_AndTheOldKey', () => {
    localStorage.setItem(OLD_KEY('t1'), queued('old'));
    localStorage.setItem(KEY('t1', 'visitor-a'), queued('from-a'));
    localStorage.setItem(KEY('t1', 'visitor-b'), queued('from-b'));

    clearTenantQueues('t1');

    expect(localStorage.getItem(OLD_KEY('t1'))).toBeNull();
    expect(localStorage.getItem(KEY('t1', 'visitor-a'))).toBeNull();
    expect(localStorage.getItem(KEY('t1', 'visitor-b'))).toBeNull();
  });

  it('ClearTenantQueues_ShouldKeepAnotherTenantsQueues_WhenItsIdStartsWithThisTenants', () => {
    localStorage.setItem(OLD_KEY('t10'), queued('old-of-t10'));
    localStorage.setItem(KEY('t10', 'visitor-a'), queued('of-t10'));

    clearTenantQueues('t1');

    expect(localStorage.getItem(OLD_KEY('t10'))).not.toBeNull();
    expect(localStorage.getItem(KEY('t10', 'visitor-a'))).not.toBeNull();
  });
});
