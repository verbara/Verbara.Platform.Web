import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateVisitorId,
  getVisitorProfile,
  setVisitorProfile,
  resetVisitor,
} from './visitor-storage';

beforeEach(() => {
  localStorage.clear();
});

describe('visitor-storage', () => {
  it('GetOrCreateVisitorId_GeneratesUuid_OnFirstCall', () => {
    const id = getOrCreateVisitorId('tenant-1');
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('GetOrCreateVisitorId_ReturnsCachedId_OnSubsequentCalls', () => {
    const id1 = getOrCreateVisitorId('tenant-1');
    const id2 = getOrCreateVisitorId('tenant-1');
    expect(id1).toBe(id2);
  });

  it('GetOrCreateVisitorId_DifferentPerTenant', () => {
    const a = getOrCreateVisitorId('tenant-a');
    const b = getOrCreateVisitorId('tenant-b');
    expect(a).not.toBe(b);
  });

  it('SetAndGetVisitorProfile_RoundTrip', () => {
    setVisitorProfile('tenant-1', { name: 'Jane', email: 'jane@x.com' });
    expect(getVisitorProfile('tenant-1')).toEqual({ name: 'Jane', email: 'jane@x.com' });
  });

  it('ResetVisitor_ClearsBothIdAndProfile', () => {
    getOrCreateVisitorId('tenant-1');
    setVisitorProfile('tenant-1', { name: 'X' });
    resetVisitor('tenant-1');
    expect(localStorage.getItem('verbara-webchat-visitor:tenant-1')).toBeNull();
    expect(localStorage.getItem('verbara-webchat-profile:tenant-1')).toBeNull();
  });
});
