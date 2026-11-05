import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetVisitorData } from './forget-visitor';

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
