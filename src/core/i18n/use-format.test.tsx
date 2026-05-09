import { describe, it, expect, beforeAll } from 'vitest';
import { renderHook } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { useFormatDate } from './use-format';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: { 'en-US': { common: {} } },
    });
  }
});

function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe('useFormatDate timezone arg', () => {
  it('FormatDateTime_AcceptsTimezone_AndReturnsZoneShiftedString', () => {
    const { result } = renderHook(() => useFormatDate(), { wrapper });
    const utc = '2026-05-08T14:30:00Z';
    // Compare distinct explicit zones — host timezone is environment-dependent.
    const utcZone = result.current.formatDateTime(utc, 'UTC');
    const bogotaZone = result.current.formatDateTime(utc, 'America/Bogota');
    const tokyoZone = result.current.formatDateTime(utc, 'Asia/Tokyo');
    // 14:30 UTC = 09:30 Bogota = 23:30 Tokyo — three distinct strings expected.
    expect(utcZone).not.toBe(bogotaZone);
    expect(bogotaZone).not.toBe(tokyoZone);
    expect(bogotaZone).toMatch(/9:30/);
    expect(tokyoZone).toMatch(/11:30/); // Tokyo (UTC+9) at 23:30 = 11:30 PM in 12h locale
  });

  it('FormatDateTime_WithoutTimezone_KeepsBrowserZone_BackwardCompat', () => {
    const { result } = renderHook(() => useFormatDate(), { wrapper });
    const utc = '2026-05-08T14:30:00Z';
    const noArg = result.current.formatDateTime(utc);
    const undefArg = result.current.formatDateTime(utc, undefined);
    expect(noArg).toBe(undefArg);
  });
});
