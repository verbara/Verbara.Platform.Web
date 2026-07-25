import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// ─── Mock i18n ───────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (typeof opts === 'string') return opts;
      if (opts && typeof opts === 'object') {
        return Object.entries(opts as Record<string, unknown>).reduce(
          (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
          key,
        );
      }
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

// ─── Mock react-router navigate so we can capture drill-down target ─────
const navigateMock = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ─── Stub Recharts ResponsiveContainer (jsdom has no layout) ────────────────
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 300 }}>
        {children}
      </div>
    ),
  };
});

// ─── Mock partner revenue hooks with multi-day spread for chart ─────────────
import type { PartnerRevenueDetail, PartnerRevenueSummary } from '@/core/api/hooks/use-partner';

const summary: PartnerRevenueSummary = {
  totalGross: 1500,
  totalPlatformCost: 600,
  totalMargin: 900,
  customerCount: 2,
  invoiceCount: 3,
};

const details: PartnerRevenueDetail[] = [
  {
    revenueId: 'rev-1',
    customerTenantId: 'cust-alpha',
    invoiceId: 'inv-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    grossAmount: 600,
    platformCost: 240,
    partnerMargin: 360,
    periodStart: '2026-04-01T00:00:00Z',
    periodEnd: '2026-04-15T00:00:00Z',
  },
  {
    revenueId: 'rev-2',
    customerTenantId: 'cust-beta',
    invoiceId: 'inv-11111111-2222-3333-4444-555555555555',
    grossAmount: 500,
    platformCost: 200,
    partnerMargin: 300,
    periodStart: '2026-04-10T00:00:00Z',
    periodEnd: '2026-04-22T00:00:00Z',
  },
  {
    revenueId: 'rev-3',
    customerTenantId: 'cust-alpha',
    invoiceId: 'inv-77777777-8888-9999-aaaa-bbbbbbbbbbbb',
    grossAmount: 400,
    platformCost: 160,
    partnerMargin: 240,
    periodStart: '2026-04-20T00:00:00Z',
    periodEnd: '2026-04-30T00:00:00Z',
  },
];

vi.mock('@/core/api/hooks/use-partner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-partner')>();
  return {
    ...actual,
    usePartnerRevenueSummary: () => ({ data: summary }),
    usePartnerRevenueDetails: () => ({ data: details }),
  };
});

import PartnerRevenuePage from '@/admin/partner/revenue-page';

function renderPage() {
  return render(
    <MemoryRouter>
      <PartnerRevenuePage />
    </MemoryRouter>,
  );
}

describe('PartnerRevenuePage trend chart + drill-down', () => {
  it('TrendChart_ShouldRenderRevenueAndMarginLines_WhenDetailsPresent', () => {
    renderPage();

    const chart = screen.getByTestId('revenue-trend-chart');
    expect(chart).toBeInTheDocument();
    // Recharts <Line /> renders SVG path elements with class names referencing
    // its dataKey. Verify both series are attached by their explicit names.
    expect(chart.querySelector('.recharts-line-revenue')).not.toBeNull();
    expect(chart.querySelector('.recharts-line-margin')).not.toBeNull();
  });

  it('RowClick_ShouldNavigateToCustomerDetail_WithDateRangeQuery', () => {
    navigateMock.mockClear();
    renderPage();

    fireEvent.click(screen.getByTestId('revenue-row-cust-alpha'));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const target = navigateMock.mock.calls[0][0] as string;
    expect(target).toMatch(/^\/admin\/partner\/customers\/cust-alpha/);
    // No filter applied yet → no query params.
    expect(target).not.toContain('from=');
    expect(target).not.toContain('until=');
  });
});
