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
    const browserZone = result.current.formatDateTime(utc);
    const bogotaZone = result.current.formatDateTime(utc, 'America/Bogota');
    expect(bogotaZone).not.toBe(browserZone);
    expect(bogotaZone).toMatch(/9:30/);
  });

  it('FormatDateTime_WithoutTimezone_KeepsBrowserZone_BackwardCompat', () => {
    const { result } = renderHook(() => useFormatDate(), { wrapper });
    const utc = '2026-05-08T14:30:00Z';
    const noArg = result.current.formatDateTime(utc);
    const undefArg = result.current.formatDateTime(utc, undefined);
    expect(noArg).toBe(undefArg);
  });
});
