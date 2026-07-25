import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

// ─── i18n: return defaultValue (or key) ────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Tenant + settings hooks ──────────────────────────────────────────────────
vi.mock('@/core/api/hooks/use-tenants', () => ({
  useTenant: () => ({
    data: { tenantId: 'demo', name: 'Demo Tenant', status: 'Active' },
  }),
}));

vi.mock('@/admin/tenants/use-tenant-settings', () => ({
  useTenantSettings: () => ({
    data: {
      tenantId: 'demo',
      name: 'Demo Tenant',
      status: 'Active',
      type: 'Customer',
      plan: 'Pro',
      rateLimitTier: 'Standard',
      enabledFeatures: [],
      addOns: [],
    },
  }),
  useUpdateTenantSettings: () => ({ mutate: vi.fn(), isPending: false }),
}));

// ─── TenantSettingsForm: stub to avoid full form rendering ────────────────────
vi.mock('@/admin/tenants/tenant-settings-form', () => ({
  TenantSettingsForm: ({ section }: { section: string }) => (
    <div data-testid={`tenant-settings-form-${section}`} />
  ),
}));

// ─── GDPR hooks consumed by RetentionPolicySection ────────────────────────────
vi.mock('@/core/api/hooks/use-gdpr', () => ({
  useRetentionPolicy: () => ({
    data: {
      conversationRetentionDays: null,
      authEventRetentionDays: null,
      auditRetentionDays: null,
      usageRecordRetentionDays: null,
    },
  }),
  useUpdateRetentionPolicy: () => ({ mutate: vi.fn(), isPending: false }),
}));

import TenantDetailPage from '@/admin/tenants/tenant-detail-page';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/tenants/demo']}>
      <Routes>
        <Route path="/admin/tenants/:tenantId" element={<TenantDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TenantDetailPage — Retention tab wire-up (S4.5)', () => {
  it('renders RetentionPolicySection inside Retention tab', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('tab-retention'));

    // Retention tab content slot still present (E2E continuity)
    expect(screen.getByTestId('retention-section-slot')).toBeInTheDocument();

    // RetentionPolicySection trigger should be wired into the tab
    expect(screen.getByTestId('retention-policy-trigger')).toBeInTheDocument();
  });
});
