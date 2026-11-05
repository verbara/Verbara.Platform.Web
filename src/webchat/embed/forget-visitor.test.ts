import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetVisitorData, readForgetVisitor } from './forget-visitor';

beforeEach(() => {
  localStorage.clear();
});

describe('forgetVisitorData', () => {
  it('ForgetVisitorData_ShouldClearEveryQueueOfTheTenant_WhenTheFrameAnswers', () => {
    localStorage.setItem('verbara-webchat-queue:t1', '[{"id":"old"}]');
    localStorage.setItem('verbara-webchat-queue:t1:visitor-a', '[{"id":"a"}]');
    localStorage.setItem('verbara-webchat-queue:t1:visitor-b', '[{"id":"b"}]');

    forgetVisitorData('t1');

    expect(localStorage.getItem('verbara-webchat-queue:t1')).toBeNull();
    expect(localStorage.getItem('verbara-webchat-queue:t1:visitor-a')).toBeNull();
    expect(localStorage.getItem('verbara-webchat-queue:t1:visitor-b')).toBeNull();
  });

  it('ForgetVisitorData_ShouldKeepAnotherTenantsQueue_WhenItsIdStartsWithThisTenants', () => {
    localStorage.setItem('verbara-webchat-queue:t10', '[{"id":"old"}]');
    localStorage.setItem('verbara-webchat-queue:t10:visitor-a', '[{"id":"a"}]');

    forgetVisitorData('t1');

    expect(localStorage.getItem('verbara-webchat-queue:t10')).not.toBeNull();
    expect(localStorage.getItem('verbara-webchat-queue:t10:visitor-a')).not.toBeNull();
  });

  it('ForgetVisitorData_ShouldNotThrow_WhenStorageIsUnavailable', () => {
    const removal = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => forgetVisitorData('t1')).not.toThrow();
    removal.mockRestore();
  });
});

// A tab that discards its own widget clears only what that widget's visitor owns: another tab may already run the next
// customer on the same storage.
describe('forgetVisitorData, for one visitor', () => {
  const session = (visitorId: string) =>
    JSON.stringify({ sessionId: 's', wsUrl: 'wss://x', visitorId, createdAt: 1, lastActiveAt: 1 });

  function seed(sessionOf: string) {
    localStorage.clear();
    localStorage.setItem('verbara-webchat-messages:t1:v-a', '[{"id":"a"}]');
    localStorage.setItem('verbara-webchat-messages:t1:v-b', '[{"id":"b"}]');
    localStorage.setItem('verbara-webchat-queue:t1:v-a', '[{"id":"qa"}]');
    localStorage.setItem('verbara-webchat-queue:t1:v-b', '[{"id":"qb"}]');
    localStorage.setItem('verbara-webchat-messages:t2:v-a', '[{"id":"t2"}]');
    localStorage.setItem('verbara-webchat-session:t1', session(sessionOf));
  }

  it('ForgetVisitorData_ShouldClearOnlyThatVisitor_AndKeepTheOthersSession', () => {
    seed('v-b');

    forgetVisitorData('t1', 'v-a');

    expect(localStorage.getItem('verbara-webchat-messages:t1:v-a')).toBeNull();
    expect(localStorage.getItem('verbara-webchat-queue:t1:v-a')).toBeNull();
    expect(localStorage.getItem('verbara-webchat-messages:t1:v-b')).not.toBeNull();
    expect(localStorage.getItem('verbara-webchat-queue:t1:v-b')).not.toBeNull();
    expect(localStorage.getItem('verbara-webchat-messages:t2:v-a')).not.toBeNull();
    expect(localStorage.getItem('verbara-webchat-session:t1')).not.toBeNull();
  });

  it('ForgetVisitorData_ShouldClearTheStoredSession_WhenItIsThatVisitors', () => {
    seed('v-a');
    forgetVisitorData('t1', 'v-a');
    expect(localStorage.getItem('verbara-webchat-session:t1')).toBeNull();
  });

  it('ForgetVisitorData_ShouldLeaveAnUnreadableSession_ForTheStartToRefuse', () => {
    seed('v-b');
    localStorage.setItem('verbara-webchat-session:t1', 'not json');
    forgetVisitorData('t1', 'v-a');
    expect(localStorage.getItem('verbara-webchat-session:t1')).toBe('not json');
  });

  it('ReadForgetVisitor_ShouldCarryTheVisitor_OnlyWhenItIsANonEmptyString', () => {
    expect(readForgetVisitor({ tenantId: 't1', visitorId: 'v-a' })).toEqual({
      tenantId: 't1',
      visitorId: 'v-a',
    });
    expect(readForgetVisitor({ tenantId: 't1', visitorId: '' })).toEqual({ tenantId: 't1' });
    expect(readForgetVisitor({ tenantId: 't1', visitorId: 7 })).toEqual({ tenantId: 't1' });
    expect(readForgetVisitor({ tenantId: 't1' })).toEqual({ tenantId: 't1' });
  });
});
