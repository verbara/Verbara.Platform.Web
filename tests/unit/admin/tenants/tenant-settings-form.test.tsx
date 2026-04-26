import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mock i18n so labels fall back to default text ─────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Mock sonner toast to spy on success/error notifications ───────────────────
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// ─── Mock the settings hook(s) the form depends on ────────────────────────────
const mutateAsync = vi.fn();
const mutateMock = { mutate: vi.fn(), mutateAsync, isPending: false } as const;
const settingsMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/admin/tenants/use-tenant-settings', () => ({
  useTenantSettings: (...args: unknown[]) => settingsMock(...args),
  useUpdateTenantSettings: (...args: unknown[]) => updateMock(...args),
}));

import { TenantSettingsForm } from '@/admin/tenants/tenant-settings-form';

const baseSettings = {
  tenantId: 'demo',
  name: 'Demo Tenant',
  type: 'Customer',
  status: 'Active',
  operational: {
    maxConcurrentChannels: 50,
    maxActiveCampaigns: 5,
    dialplanContextPrefix: null,
    nodeAffinity: null,
    allowedDialingModes: null,
  },
  auth: {
    mfaPolicy: 'Optional',
    mfaRequiredRoles: [],
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false,
    lockoutThreshold: 5,
    lockoutDurationMinutes: 15,
    sessionIdleTimeoutMinutes: 30,
    sessionAbsoluteTimeoutHours: 12,
    oidcEnabled: false,
    oidcAuthority: null,
    oidcClientId: null,
    oidcAutoCreateUsers: false,
    oidcDefaultRole: 'agent',
    impersonationMaxConcurrentSessions: 1,
    impersonationAutoTimeoutMinutes: 60,
  },
  quotas: {
    maxMonthlyVoiceMinutes: null,
    maxMonthlyMessages: null,
    maxStorageBytes: null,
    maxActiveAgents: null,
    quotaAction: 'Warn',
  },
  retention: {
    conversationRetentionDays: null,
    authEventRetentionDays: null,
    auditRetentionDays: null,
    usageRecordRetentionDays: null,
  },
  rateLimitTier: 'Standard',
  plan: 'Pro',
  enabledFeatures: [],
  addOns: [],
  dunning: null,
  branding: null,
};

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  mutateAsync.mockReset();
  settingsMock.mockReset();
  updateMock.mockReset();
  settingsMock.mockReturnValue({ data: baseSettings, isLoading: false, error: null });
  updateMock.mockReturnValue({ ...mutateMock, mutateAsync });
});

describe('TenantSettingsForm', () => {
  it('Render_ShouldShowAllSettingsFields_WhenSettingsLoaded', () => {
    render(<TenantSettingsForm tenantId="demo" section="operational" />);

    expect(screen.getByTestId('tenant-settings-form-operational')).toBeInTheDocument();
    expect(screen.getByTestId('field-maxConcurrentChannels')).toHaveValue(50);
    expect(screen.getByTestId('field-maxActiveCampaigns')).toHaveValue(5);
  });

  it('Validate_ShouldBlockSubmit_WhenRequiredFieldEmpty', async () => {
    render(<TenantSettingsForm tenantId="demo" section="operational" />);

    const channels = screen.getByTestId('field-maxConcurrentChannels') as HTMLInputElement;
    fireEvent.change(channels, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('tenant-settings-submit'));

    await waitFor(() => {
      expect(mutateAsync).not.toHaveBeenCalled();
    });
    expect(screen.getByTestId('field-error-maxConcurrentChannels')).toBeInTheDocument();
  });

  it('Submit_ShouldCallUpdateMutation_WhenFormValid', async () => {
    mutateAsync.mockResolvedValue({});
    render(<TenantSettingsForm tenantId="demo" section="operational" />);

    fireEvent.change(screen.getByTestId('field-maxConcurrentChannels'), {
      target: { value: '75' },
    });
    fireEvent.click(screen.getByTestId('tenant-settings-submit'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      operational: expect.objectContaining({ maxConcurrentChannels: 75 }),
    });
  });

  it('Submit_ShouldShowSuccessToast_WhenMutationResolves', async () => {
    mutateAsync.mockResolvedValue({});
    render(<TenantSettingsForm tenantId="demo" section="operational" />);

    fireEvent.click(screen.getByTestId('tenant-settings-submit'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('Submit_ShouldShowErrorToast_WhenMutationRejects', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'));
    render(<TenantSettingsForm tenantId="demo" section="operational" />);

    fireEvent.click(screen.getByTestId('tenant-settings-submit'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
