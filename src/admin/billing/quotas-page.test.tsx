import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatNumber: () => ({
    formatNumber: (n: number) => String(n),
    formatCurrency: (n: number) => String(n),
  }),
}));

vi.mock('@/core/api/hooks/use-billing', () => ({
  useQuotaStatus: vi.fn(),
  useUpdateQuota: vi.fn(),
  useDunningStatus: vi.fn(),
  QUOTA_ACTIONS: ['Warn', 'SoftBlock', 'HardBlock'],
}));

vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: (select: (s: { activeTenantId: string | null }) => unknown) =>
    select({ activeTenantId: 'ten-acme' }),
}));

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: (select: (s: { tenantId: string | null }) => unknown) =>
    select({ tenantId: 'ten-acme' }),
}));

import { asMock } from '@/tests/utils/as-mock';
import { useDunningStatus, useQuotaStatus, useUpdateQuota } from '@/core/api/hooks/use-billing';
import QuotasPage from './quotas-page';

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe('QuotasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    asMock(useUpdateQuota).mockReturnValue({ mutate: vi.fn() });
    asMock(useDunningStatus).mockReturnValue({ data: undefined });
    asMock(useQuotaStatus).mockReturnValue({
      data: {
        tenantId: 'ten-acme',
        quota: {
          maxConcurrentChannels: 100,
          maxActiveCampaigns: 10,
          maxMonthlyVoiceMinutes: 1000,
          maxMonthlyMessages: null,
          maxStorageBytes: null,
          maxActiveAgents: 25,
          quotaAction: 'Warn',
        },
        currentUsage: [{ usageType: 'Voice', totalQuantity: 950 }],
      },
    });
  });

  it('ActiveAgentsRow_ShouldExplainItIsAPerTenantQuota_WhenQuotaLoaded', () => {
    render(<QuotasPage />, { wrapper });

    const hint = screen.getByTestId('quota-active-agents-hint');
    expect(hint.textContent).toBe('billing.quotas.rows.active_agents_hint');
    expect(hint.parentElement?.textContent).toContain('billing.quotas.rows.active_agents');
  });

  it('QuotaRow_ShouldKeepTheQuotaColourScale_WhenUsageIsNinetyFivePercent', () => {
    render(<QuotasPage />, { wrapper });

    const meters = screen.getAllByRole('meter');
    const voice = meters.find((m) => m.getAttribute('aria-valuenow') === '950')!;
    expect(voice.getAttribute('data-tone')).toBe('quota');
    expect((voice.firstElementChild as HTMLElement).className).toContain('bg-destructive');
    // The hint is on the active-agents row alone.
    expect(screen.getAllByTestId('quota-active-agents-hint')).toHaveLength(1);
  });
});
