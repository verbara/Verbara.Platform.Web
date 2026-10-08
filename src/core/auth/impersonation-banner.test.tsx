import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from './auth-store';
import { ImpersonationBanner } from './impersonation-banner';
import { createWrapper } from '@/test/hook-test-utils';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;
const OPERATOR_EXPIRY = Date.now() + 3600_000;

function impersonateUntil(expiresAt: number): void {
  useAuthStore.getState().setAuth('operator-token', OPERATOR_EXPIRY, A_USER, 'tenant-1', [], {});
  useAuthStore.getState().startImpersonation(
    {
      accessToken: 'impersonation-token',
      expiresAt: new Date(expiresAt).toISOString(),
      targetTenantId: 'tenant-9',
      targetTenantName: 'ACME',
    },
    'operator-token',
    'tenant-1',
  );
}

function lastNoticeContent(): ReactElement {
  const content = vi.mocked(toast.info).mock.calls.at(-1)?.[0] as ReactElement | undefined;
  if (!content) throw new Error('No notice was shown.');
  return content;
}

describe('ImpersonationBanner countdown (H17, design D3)', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    vi.mocked(toast.info).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should_EndTheImpersonationAndShowTheEndedNotice_WhenItsExpiryPasses', () => {
    impersonateUntil(Date.now() + 2_000);
    render(<ImpersonationBanner />, { wrapper: createWrapper() });
    expect(screen.getByTestId('impersonation-banner')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    const state = useAuthStore.getState();
    expect(state.impersonation).toBeNull();
    expect(state.accessToken).toBe('operator-token');
    expect(state.tokenExpiry).toBe(OPERATOR_EXPIRY);
    expect(state.tenantId).toBe('tenant-1');
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('impersonation-banner')).toBeNull();
  });

  it.each(TEST_LOCALES)('should_RenderTheEndedNoticeLocalized_In%s', async (locale) => {
    vi.useRealTimers();
    impersonateUntil(Date.now() - 1_000);
    render(<ImpersonationBanner />, { wrapper: createWrapper() });

    const i18n = await createLocaleI18n(locale);
    render(
      <I18nextProvider i18n={i18n}>
        <div data-testid="toast">{lastNoticeContent()}</div>
      </I18nextProvider>,
    );

    const notice = screen.getByTestId('toast').querySelector('[data-notice-code]');
    expect(notice).toHaveAttribute('data-notice-code', 'impersonation-ended');
    expect(notice?.textContent).toBe(i18n.t('impersonation.ended'));
    expect(notice?.textContent).not.toBe('impersonation.ended');
  });
});
