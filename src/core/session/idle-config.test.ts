import { resolveIdleMinutes, idleMs, warningAtMs, WARNING_BEFORE_MS } from './idle-config';

describe('idle-config', () => {
  describe('resolveIdleMinutes', () => {
    it('should_ReturnDefault30_WhenValueIsNull', () => {
      expect(resolveIdleMinutes(null)).toBe(30);
    });

    it('should_ReturnDefault30_WhenValueIsUndefined', () => {
      expect(resolveIdleMinutes(undefined)).toBe(30);
    });

    it('should_ReturnDefault30_WhenValueIsZero', () => {
      expect(resolveIdleMinutes(0)).toBe(30);
    });

    it('should_ReturnDefault30_WhenValueIsNegative', () => {
      expect(resolveIdleMinutes(-5)).toBe(30);
    });

    it('should_ReturnValue_WhenValueIsPositive', () => {
      expect(resolveIdleMinutes(15)).toBe(15);
    });
  });

  describe('warningAtMs', () => {
    it('should_BeIdleMsMinusWarningWindow_WhenComputed', () => {
      expect(warningAtMs(30)).toBe(idleMs(30) - WARNING_BEFORE_MS);
    });
  });
});
