import { describe, it, expect, beforeEach } from 'vitest';
import { createOfflineQueue } from './offline-queue';

beforeEach(() => {
  localStorage.clear();
});

describe('offline-queue', () => {
  it('Push_PersistsToLocalStorage', () => {
    const q = createOfflineQueue('tenant-1');
    q.push({ id: 'm1', text: 'hi', timestamp: '2026-05-09T10:00:00Z' });
    expect(localStorage.getItem('verbara-webchat-queue:tenant-1')).toContain('m1');
  });

  it('Drain_ReturnsAllItems_AndClears', () => {
    const q = createOfflineQueue('tenant-1');
    q.push({ id: 'm1', text: 'a', timestamp: '2026-05-09T10:00:00Z' });
    q.push({ id: 'm2', text: 'b', timestamp: '2026-05-09T10:00:01Z' });
    const items = q.drain();
    expect(items).toHaveLength(2);
    expect(q.size()).toBe(0);
  });

  it('Persist_AcrossInstances', () => {
    const q1 = createOfflineQueue('tenant-1');
    q1.push({ id: 'm1', text: 'hi', timestamp: '2026-05-09T10:00:00Z' });
    const q2 = createOfflineQueue('tenant-1');
    expect(q2.size()).toBe(1);
  });

  it('Cap_LimitsToMaxItems_DropsOldest', () => {
    const q = createOfflineQueue('tenant-1', { maxItems: 3 });
    for (let i = 0; i < 5; i++) {
      q.push({ id: `m${i}`, text: String(i), timestamp: '2026-05-09T10:00:00Z' });
    }
    const items = q.drain();
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.id)).toEqual(['m2', 'm3', 'm4']);
  });
});
