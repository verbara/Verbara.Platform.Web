import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { ReactNode } from 'react';

// ─── Mock i18n ───────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Mock partner hooks ──────────────────────────────────────────────────────
const suspendMutate = vi.fn();
const activateMutate = vi.fn();
const updateMutate = vi.fn();

const fakeCustomer = {
  tenantId: 'cust-123',
  name: 'Acme Corp',
  status: 'Active',
  plan: 'Pro',
  createdAt: '2026-04-01T00:00:00Z',
};

vi.mock('@/core/api/hooks/use-partner', () => ({
  usePartnerCustomer: () => ({ data: fakeCustomer }),
  useUpdatePartnerCustomer: () => ({ mutate: updateMutate, isPending: false }),
  useSuspendCustomer: () => ({ mutate: suspendMutate, isPending: false }),
  useActivateCustomer: () => ({ mutate: activateMutate, isPending: false }),
  useCustomerSettings: () => ({ data: undefined, isLoading: false }),
  useUpdateCustomerSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomerInvoices: () => ({ data: [] }),
  useGeneratePartnerInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useCustomerUsage: () => ({ data: [] }),
}));

import PartnerCustomerDetailPage from '@/admin/partner/customer-detail-page';

function Wrap({ children }: Readonly<{ children: ReactNode }>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/partner/customers/cust-123']}>
        <Routes>
          <Route path="/admin/partner/customers/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PartnerCustomerDetailPage — Suspend ConfirmDialog', () => {
  beforeEach(() => {
    suspendMutate.mockClear();
    activateMutate.mockClear();
  });

  it('SuspendButton_ShouldOpenConfirmDialog_WhenClicked', () => {
    render(
      <Wrap>
        <PartnerCustomerDetailPage />
      </Wrap>,
    );

    // Dialog should not be open initially.
    expect(screen.queryByTestId('suspend-confirm-dialog')).toBeNull();

    // Click suspend button — dialog opens, mutate is NOT called yet.
    fireEvent.click(screen.getByTestId('suspend-customer'));
    expect(screen.getByTestId('suspend-confirm-dialog')).toBeInTheDocument();
    expect(suspendMutate).not.toHaveBeenCalled();
  });

  it('SuspendConfirm_ShouldPassReasonToMutation_WhenWordTypedAndReasonProvided', () => {
    render(
      <Wrap>
        <PartnerCustomerDetailPage />
      </Wrap>,
    );

    fireEvent.click(screen.getByTestId('suspend-customer'));

    // Type the customer name into the confirmation word input.
    const wordInput = screen.getByTestId('suspend-confirm-word');
    fireEvent.change(wordInput, { target: { value: 'Acme Corp' } });

    // Fill reason field.
    const reasonInput = screen.getByTestId('suspend-confirm-reason');
    fireEvent.change(reasonInput, { target: { value: 'Non-payment 30 days overdue' } });

    // Click confirm — mutation called with { id, reason } payload.
    fireEvent.click(screen.getByTestId('suspend-confirm-submit'));

    expect(suspendMutate).toHaveBeenCalledTimes(1);
    expect(suspendMutate).toHaveBeenCalledWith({
      id: 'cust-123',
      reason: 'Non-payment 30 days overdue',
    });
  });
});
