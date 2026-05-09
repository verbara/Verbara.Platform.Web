import { describe, it, expect, beforeAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { useFormatPhone } from './use-format-phone';

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

describe('useFormatPhone', () => {
  it('FormatPhone_ReturnsFormattedString_ForValidE164', async () => {
    const { result } = renderHook(() => useFormatPhone(), { wrapper });
    await waitFor(() => {
      const formatted = result.current.formatPhone('+19255550100');
      expect(formatted).toMatch(/925/);
      expect(formatted).toMatch(/555/);
    });
  });

  it('FormatPhone_ReturnsRaw_OnParseFailure', async () => {
    const { result } = renderHook(() => useFormatPhone(), { wrapper });
    await waitFor(() => {
      expect(result.current.formatPhone('garbage')).toBe('garbage');
    });
  });

  it('ParsePhone_ReturnsStructuredObject_ForValidInput', async () => {
    const { result } = renderHook(() => useFormatPhone(), { wrapper });
    await waitFor(() => {
      const parsed = result.current.parsePhone('+19255550100');
      expect(parsed).not.toBeNull();
      expect(parsed?.e164).toBe('+19255550100');
      expect(parsed?.country).toBe('US');
    });
  });

  it('ParsePhone_ReturnsNull_ForGarbage', async () => {
    const { result } = renderHook(() => useFormatPhone(), { wrapper });
    await waitFor(() => {
      expect(result.current.parsePhone('garbage')).toBeNull();
    });
  });

  it('IsValidPhone_FlagsMalformedNumbers', async () => {
    const { result } = renderHook(() => useFormatPhone(), { wrapper });
    await waitFor(() => {
      expect(result.current.isValidPhone('+19255550100')).toBe(true);
      expect(result.current.isValidPhone('not-a-number')).toBe(false);
    });
  });

  it('GetDefaultCountry_FallsBackToUS', () => {
    const { result } = renderHook(() => useFormatPhone(), { wrapper });
    expect(result.current.getDefaultCountry()).toBe('US');
  });
});
