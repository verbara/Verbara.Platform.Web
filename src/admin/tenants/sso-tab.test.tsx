import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { SsoTab } from './sso-tab';
import type { TenantSettingsDto } from './use-tenant-settings';

const mutateMock = vi.fn();
const settingsRef: { value: TenantSettingsDto | undefined } = { value: undefined };

vi.mock('./use-tenant-settings', () => ({
  useTenantSettings: () => ({ data: settingsRef.value, isLoading: false }),
  useUpdateTenantSettings: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'admin',
      ns: ['admin', 'common'],
      resources: {
        'en-US': {
          admin: {
            tenants: {
              sso: {
                tabTitle: 'OpenID Connect (SSO)',
                description: 'Configure IdP',
                enabled: 'Enable OIDC sign-in',
                authority: 'Authority URL',
                authorityHint: 'hint',
                clientId: 'Client ID',
                clientSecret: 'Client secret',
                clientSecretConfigured: 'Configured',
                clientSecretNotConfigured: 'Not configured',
                clientSecretHint: 'leave blank to keep',
                autoCreateUsers: 'Auto-create users',
                autoCreateUsersHint: 'hint',
                defaultRole: 'Default role',
                save: 'Save SSO configuration',
                savedToast: 'SSO updated',
                testSignIn: 'Test sign-in',
                testSignInHint: 'opens new tab',
                validation: {
                  authorityRequired: 'Authority required',
                  clientIdRequired: 'Client ID required',
                  authorityInvalid: 'Must be URL',
                },
                upgrade: {
                  title: 'OIDC SSO not enabled',
                  body: 'Contact account manager',
                },
              },
            },
          },
          common: { a11y: { required: 'required' } },
        },
      },
    });
  }
});

beforeEach(() => {
  mutateMock.mockClear();
});

function makeSettings(overrides?: Partial<TenantSettingsDto>): TenantSettingsDto {
  const baseAuth = {
    mfaPolicy: 'optional',
    mfaRequiredRoles: [],
    passwordMinLength: 8,
    passwordRequireUppercase: false,
    passwordRequireNumber: false,
    passwordRequireSpecial: false,
    lockoutThreshold: 5,
    lockoutDurationMinutes: 15,
    sessionIdleTimeoutMinutes: 30,
    sessionAbsoluteTimeoutHours: 12,
    oidcEnabled: false,
    oidcAuthority: null,
    oidcClientId: null,
    oidcAutoCreateUsers: true,
    oidcDefaultRole: 'Agent',
    impersonationMaxConcurrentSessions: 0,
    impersonationAutoTimeoutMinutes: 30,
  };
  const { auth: authOverride, ...rest } = overrides ?? {};
  return {
    tenantId: 't1',
    name: 'Acme',
    type: 'standard',
    status: 'active',
    operational: {
      maxConcurrentChannels: 100,
      maxActiveCampaigns: 5,
      dialplanContextPrefix: null,
      nodeAffinity: null,
      allowedDialingModes: null,
    },
    quotas: {
      maxMonthlyVoiceMinutes: null,
      maxMonthlyMessages: null,
      maxStorageBytes: null,
      maxActiveAgents: null,
      quotaAction: 'warn',
    },
    retention: {
      conversationRetentionDays: null,
      authEventRetentionDays: null,
      auditRetentionDays: null,
      usageRecordRetentionDays: null,
    },
    rateLimitTier: 'standard',
    plan: 'pro',
    enabledFeatures: ['OidcSso'],
    addOns: [],
    dunning: null,
    branding: null,
    ...rest,
    auth: { ...baseAuth, ...(authOverride ?? {}) },
  };
}

function wrap(ui: ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('SsoTab', () => {
  it('Renders_UpgradeMessage_WhenOidcSsoFeatureDisabled', () => {
    settingsRef.value = makeSettings({ enabledFeatures: [] });
    render(wrap(<SsoTab tenantId="t1" />));
    expect(screen.getByText(/oidc sso not enabled/i)).toBeInTheDocument();
  });

  it('Renders_FormFields_WhenFeatureEnabled', () => {
    settingsRef.value = makeSettings();
    render(wrap(<SsoTab tenantId="t1" />));
    expect(screen.getByText(/enable oidc sign-in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/authority url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/client secret/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default role/i)).toBeInTheDocument();
  });

  it('OidcClientSecret_LeftBlank_NotIncludedInPayload', async () => {
    settingsRef.value = makeSettings({
      auth: {
        oidcEnabled: true,
        oidcAuthority: 'https://idp.example.com',
        oidcClientId: 'client-123',
      } as TenantSettingsDto['auth'],
    });
    render(wrap(<SsoTab tenantId="t1" />));
    fireEvent.click(screen.getByRole('button', { name: /save sso/i }));
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
    const payload = mutateMock.mock.calls[0]?.[0] as { auth?: { oidcClientSecret?: string } };
    expect(payload.auth?.oidcClientSecret).toBeUndefined();
  });

  it('OidcClientSecret_NonEmpty_IncludedInPayload', async () => {
    settingsRef.value = makeSettings({
      auth: {
        oidcEnabled: true,
        oidcAuthority: 'https://idp.example.com',
        oidcClientId: 'client-123',
      } as TenantSettingsDto['auth'],
    });
    render(wrap(<SsoTab tenantId="t1" />));
    const secretInput = screen.getByLabelText(/client secret/i) as HTMLInputElement;
    fireEvent.change(secretInput, { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /save sso/i }));
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
    const payload = mutateMock.mock.calls[0]?.[0] as { auth?: { oidcClientSecret?: string } };
    expect(payload.auth?.oidcClientSecret).toBe('new-secret');
  });

  it('TestSignInButton_OpensNewTab_WhenAllRequiredFieldsPresent', () => {
    settingsRef.value = makeSettings({
      auth: {
        oidcEnabled: true,
        oidcAuthority: 'https://idp.example.com',
        oidcClientId: 'client-123',
      } as TenantSettingsDto['auth'],
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(wrap(<SsoTab tenantId="t1" />));
    const testBtn = screen.getByRole('button', { name: /test sign-in/i });
    expect(testBtn).not.toBeDisabled();
    fireEvent.click(testBtn);
    expect(openSpy).toHaveBeenCalled();
    const url = openSpy.mock.calls[0]?.[0];
    expect(String(url)).toMatch(/\/api\/v1\/auth\/oidc\/login\?tenant_id=t1/);
    openSpy.mockRestore();
  });

  it('TestSignInButton_Disabled_WhenRequiredFieldsMissing', () => {
    settingsRef.value = makeSettings({
      auth: {
        oidcEnabled: false,
        oidcAuthority: null,
        oidcClientId: null,
      } as TenantSettingsDto['auth'],
    });
    render(wrap(<SsoTab tenantId="t1" />));
    expect(screen.getByRole('button', { name: /test sign-in/i })).toBeDisabled();
  });
});
