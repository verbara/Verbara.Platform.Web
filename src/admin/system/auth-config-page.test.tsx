import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { AuthConfig } from '@/core/api/hooks/use-auth-admin';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // `t(key, defaultValue?)` returns the string default when given one, else the
    // key — matching the `t('ns:key', 'Default')` call shape used throughout the page.
    t: (key: string, second?: unknown) => (typeof second === 'string' ? second : key),
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { useAuthConfigMock, updateMutateMock } = vi.hoisted(() => ({
  useAuthConfigMock: vi.fn(),
  updateMutateMock: vi.fn(),
}));

vi.mock('@/core/api/hooks/use-auth-admin', () => ({
  useAuthConfig: () => useAuthConfigMock(),
  useUpdateAuthConfig: () => ({ mutate: updateMutateMock, isPending: false }),
}));

vi.mock('@/core/api/hooks/use-rbac', () => ({
  useRoles: () => ({ data: [] }),
}));

import AuthConfigPage from './auth-config-page';

function makeConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    mfaPolicy: 'optional',
    mfaRequiredRoles: [],
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false,
    lockoutThreshold: 5,
    lockoutDurationMinutes: 15,
    sessionIdleTimeoutMinutes: 30,
    sessionAbsoluteTimeoutHours: 12,
    pendingPauseTimeoutMinutes: 30,
    oidcEnabled: false,
    oidcAuthority: null,
    oidcClientId: null,
    oidcClientSecret: null,
    oidcAutoCreateUsers: true,
    oidcDefaultRole: 'Agent',
    ...overrides,
  };
}

describe('AuthConfigPage deferred-pause timeout (W4, ADR-0009)', () => {
  beforeEach(() => {
    updateMutateMock.mockReset();
  });

  it('AuthConfigPage_ShouldRenderLoading_WhenConfigAbsent', () => {
    useAuthConfigMock.mockReturnValue({ data: undefined });
    render(<AuthConfigPage />);
    expect(screen.queryByTestId('auth-config-pendingPauseTimeout')).toBeNull();
  });

  it('AuthConfigPage_ShouldRenderPendingPauseTimeout_FromConfig', () => {
    useAuthConfigMock.mockReturnValue({ data: makeConfig({ pendingPauseTimeoutMinutes: 30 }) });
    render(<AuthConfigPage />);
    const input = screen.getByTestId('auth-config-pendingPauseTimeout') as HTMLInputElement;
    expect(input.value).toBe('30');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '480');
  });

  it('AuthConfigPage_ShouldSendPendingPauseTimeout_WhenChangedAndSaved', () => {
    useAuthConfigMock.mockReturnValue({ data: makeConfig({ pendingPauseTimeoutMinutes: 30 }) });
    render(<AuthConfigPage />);

    const input = screen.getByTestId('auth-config-pendingPauseTimeout') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '45' } });
    expect(input.value).toBe('45');

    fireEvent.click(screen.getByTestId('auth-config-save'));

    expect(updateMutateMock).toHaveBeenCalledTimes(1);
    const payload = updateMutateMock.mock.calls[0]?.[0] as Partial<AuthConfig>;
    expect(payload.pendingPauseTimeoutMinutes).toBe(45);
  });

  it('AuthConfigPage_ShouldSendZeroPendingPauseTimeout_WhenDisabled', () => {
    // 0 disables the force-apply timeout (server-enforced); the editor must be
    // able to carry a literal 0 through to the update payload as a Number.
    useAuthConfigMock.mockReturnValue({ data: makeConfig({ pendingPauseTimeoutMinutes: 30 }) });
    render(<AuthConfigPage />);

    const input = screen.getByTestId('auth-config-pendingPauseTimeout') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });

    fireEvent.click(screen.getByTestId('auth-config-save'));

    const payload = updateMutateMock.mock.calls[0]?.[0] as Partial<AuthConfig>;
    expect(payload.pendingPauseTimeoutMinutes).toBe(0);
  });

  it('AuthConfigPage_ShouldKeepSaveDisabled_UntilFormDirtied', () => {
    useAuthConfigMock.mockReturnValue({ data: makeConfig() });
    render(<AuthConfigPage />);
    // No edits yet → save button disabled (not dirty).
    expect(screen.getByTestId('auth-config-save')).toBeDisabled();

    fireEvent.change(screen.getByTestId('auth-config-pendingPauseTimeout'), {
      target: { value: '60' },
    });
    expect(screen.getByTestId('auth-config-save')).not.toBeDisabled();
  });
});
