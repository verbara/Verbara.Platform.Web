import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { TenantBadge } from './tenant-badge';

interface AuthState {
  impersonation: { active: boolean; targetTenantName: string } | null;
}
let authState: AuthState = { impersonation: null };
let tenantData: { tenantId: string; name: string } | undefined = {
  tenantId: 't1',
  name: 'Acme Corp',
};

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: (selector: (s: AuthState) => unknown) => selector(authState),
}));
vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: (selector: (s: { activeTenantId: string }) => unknown) =>
    selector({ activeTenantId: 't1' }),
}));
vi.mock('@/core/api/hooks/use-tenants', () => ({
  useTenant: () => ({ data: tenantData }),
}));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: {
        'en-US': {
          common: {
            tenant: {
              badge: {
                tooltip: 'Tenant: {{name}} ({{id}})',
                impersonating: 'Impersonating: {{name}}',
                loading: 'Loading tenant…',
              },
            },
          },
        },
      },
    });
  }
});

function wrap(ui: ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('TenantBadge', () => {
  it('Renders_TenantName_WhenLoaded', () => {
    authState = { impersonation: null };
    tenantData = { tenantId: 't1', name: 'Acme Corp' };
    render(wrap(<TenantBadge />));
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it('Renders_LoadingState_WhenTenantUnresolved', () => {
    authState = { impersonation: null };
    tenantData = undefined;
    render(wrap(<TenantBadge />));
    expect(screen.getByText(/loading tenant/i)).toBeInTheDocument();
  });

  it('Renders_ImpersonationVariant_WhenActive', () => {
    authState = {
      impersonation: { active: true, targetTenantName: 'Target Co' },
    };
    tenantData = { tenantId: 't2', name: 'Target Co' };
    render(wrap(<TenantBadge />));
    const badge = screen.getByLabelText(/impersonating/i);
    expect(badge).toBeInTheDocument();
  });
});
