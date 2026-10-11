import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatNumber: () => ({
    formatNumber: (n: number) => String(n),
    formatCurrency: (n: number) => String(n),
  }),
}));

vi.mock('@/core/api/hooks/use-partner', () => ({
  usePartnerCustomer: vi.fn(),
  useUpdatePartnerCustomer: vi.fn(),
  useSuspendCustomer: vi.fn(),
  useActivateCustomer: vi.fn(),
  useCustomerSettings: vi.fn(),
  useUpdateCustomerSettings: vi.fn(),
  useCustomerInvoices: vi.fn(),
  useGeneratePartnerInvoice: vi.fn(),
  useCustomerUsage: vi.fn(),
}));

vi.mock('@/core/api/hooks/use-billing', () => ({
  useDunningStatus: vi.fn(),
  useUpdateDunningStatus: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import * as partner from '@/core/api/hooks/use-partner';
import { useDunningStatus, useUpdateDunningStatus } from '@/core/api/hooks/use-billing';
import PartnerCustomerDetailPage from './customer-detail-page';

const mutation = () => ({ mutate: vi.fn(), isPending: false });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/partner/customers/pc1']}>
      <Routes>
        <Route path="/admin/partner/customers/:id" element={<PartnerCustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PartnerCustomerDetailPage — no dunning in the Partner portal (P1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    asMock(partner.usePartnerCustomer).mockReturnValue({
      data: {
        tenantId: 'pc1',
        name: 'Customer One',
        plan: 'Pro',
        status: 'Active',
        createdAt: '2026-09-01T00:00:00Z',
      },
    });
    asMock(partner.useUpdatePartnerCustomer).mockReturnValue(mutation());
    asMock(partner.useSuspendCustomer).mockReturnValue(mutation());
    asMock(partner.useActivateCustomer).mockReturnValue(mutation());
    asMock(partner.useCustomerSettings).mockReturnValue({ data: {}, isLoading: false });
    asMock(partner.useUpdateCustomerSettings).mockReturnValue(mutation());
    asMock(partner.useCustomerInvoices).mockReturnValue({ data: [] });
    asMock(partner.useGeneratePartnerInvoice).mockReturnValue(mutation());
    asMock(partner.useCustomerUsage).mockReturnValue({ data: [] });
    asMock(useDunningStatus).mockReturnValue({ data: { isPaused: false } });
    asMock(useUpdateDunningStatus).mockReturnValue(mutation());
  });

  it('CustomerDetail_ShouldNotRenderTheDunningToggle_WhenAPartnerOpensACustomer', () => {
    renderPage();

    expect(screen.getByTestId('partner-customer-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('dunning-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dunning-confirm-dialog')).not.toBeInTheDocument();
  });

  it('CustomerDetail_ShouldNeverReadOrChangeDunning_WhenAPartnerOpensACustomer', () => {
    renderPage();

    expect(useDunningStatus).not.toHaveBeenCalled();
    expect(useUpdateDunningStatus).not.toHaveBeenCalled();
  });
});
