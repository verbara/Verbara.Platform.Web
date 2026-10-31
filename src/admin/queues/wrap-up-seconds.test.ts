import { describe, it, expect } from 'vitest';
import { isWrapUpSecondsAccepted, wrapUpSecondsToApi } from './wrap-up-seconds';

describe('wrap-up seconds', () => {
  it.each(['', ' ', '0', '1', '30', '600'])(
    'isWrapUpSecondsAccepted_ShouldAccept_WhenValueIs "%s"',
    (value) => {
      expect(isWrapUpSecondsAccepted(value)).toBe(true);
    },
  );

  it.each(['601', '-1', '1.5', '1e2', 'abc'])(
    'isWrapUpSecondsAccepted_ShouldRefuse_WhenValueIs "%s"',
    (value) => {
      expect(isWrapUpSecondsAccepted(value)).toBe(false);
    },
  );

  it('wrapUpSecondsToApi_ShouldSendZero_WhenValueIsZero', () => {
    expect(wrapUpSecondsToApi('0')).toBe(0);
  });

  it('wrapUpSecondsToApi_ShouldSendTheFallback_WhenValueIsEmpty', () => {
    expect(wrapUpSecondsToApi('')).toBe(30);
  });

  it('wrapUpSecondsToApi_ShouldSendTheNumber_WhenValueIsInRange', () => {
    expect(wrapUpSecondsToApi('600')).toBe(600);
  });
});
