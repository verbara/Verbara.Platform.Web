import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const createMutate = vi.fn();

vi.mock('@/core/api/hooks/use-partner', () => ({
  usePartnerCustomers: () => ({ data: [] }),
  useCreatePartnerCustomer: () => ({ mutate: createMutate, isPending: false }),
  useUpdatePartnerCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  useActivateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
  PARTNER_PLAN_OPTIONS: ['Starter', 'Pro', 'Enterprise'],
  PARTNER_TEMPLATE_OPTIONS: ['support', 'sales', 'blended'],
}));

import PartnerCustomersPage from './customers-page';

function renderPage() {
  return render(
    <MemoryRouter>
      <PartnerCustomersPage />
    </MemoryRouter>,
  );
}

function fillCreateForm() {
  fireEvent.click(screen.getByTestId('create-customer'));
  fireEvent.change(screen.getByTestId('customer-tenant-id'), { target: { value: 'pc1' } });
  fireEvent.change(screen.getByTestId('customer-name'), { target: { value: 'Customer One' } });
}

async function choosePlan(plan: string) {
  fireEvent.click(screen.getByTestId('customer-plan'));
  const option = await screen.findByTestId(`customer-plan-option-${plan}`);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

function sentBody(call = 0): Record<string, unknown> {
  return createMutate.mock.calls[call][0] as Record<string, unknown>;
}

describe('PartnerCustomersPage — plan at birth (P3, design D7)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CreateCustomer_ShouldOmitThePlan_WhenThePlanChoiceIsUntouched', () => {
    renderPage();
    fillCreateForm();

    fireEvent.click(screen.getByTestId('customer-submit'));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(Object.keys(sentBody())).not.toContain('plan');
  });

  it('CreateCustomer_ShouldSendTheChosenPlan_WhenTheAdministratorPicksPro', async () => {
    renderPage();
    fillCreateForm();
    await choosePlan('Pro');

    fireEvent.click(screen.getByTestId('customer-submit'));

    expect(sentBody()).toMatchObject({ plan: 'Pro' });
  });

  it('CreateCustomer_ShouldResetToInherit_WhenTheCreateSucceeds', async () => {
    renderPage();
    fillCreateForm();
    await choosePlan('Pro');
    fireEvent.click(screen.getByTestId('customer-submit'));
    const options = createMutate.mock.calls[0][1] as { onSuccess: () => void };
    options.onSuccess();

    fillCreateForm();
    fireEvent.click(screen.getByTestId('customer-submit'));

    expect(Object.keys(sentBody(1))).not.toContain('plan');
  });

  it('CreateCustomer_ShouldKeepTheDialogOpen_WhenTheCreateIsRefused', () => {
    renderPage();
    fillCreateForm();

    fireEvent.click(screen.getByTestId('customer-submit'));

    expect(screen.getByTestId('customer-submit')).toBeInTheDocument();
    expect(screen.getByTestId('customer-name')).toHaveValue('Customer One');
  });
});
