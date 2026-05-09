import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from './theme-apply';

beforeEach(() => {
  document.documentElement.style.cssText = '';
});

describe('applyTheme', () => {
  it('SetsPrimaryColor_WhenValidHex', () => {
    applyTheme({ primaryColor: '#ff0066' });
    expect(document.documentElement.style.getPropertyValue('--vw-primary')).toBe('#ff0066');
  });
  it('IgnoresInvalidColor', () => {
    applyTheme({ primaryColor: 'javascript:alert(1)' });
    expect(document.documentElement.style.getPropertyValue('--vw-primary')).toBe('');
  });
  it('AcceptsRgb', () => {
    applyTheme({ primaryColor: 'rgb(255,0,102)' });
    expect(document.documentElement.style.getPropertyValue('--vw-primary')).toBe('rgb(255,0,102)');
  });
  it('SetsFontFamily_StrippingDangerous', () => {
    applyTheme({ fontFamily: 'Inter; }<script>' });
    expect(document.documentElement.style.getPropertyValue('--vw-font')).toBe('Inter }script');
  });
  it('NoOp_WhenUndefined', () => {
    applyTheme(undefined);
    expect(document.documentElement.style.cssText).toBe('');
  });
});
