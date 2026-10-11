import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-billing', () => ({
  USAGE_TYPES: ['VoiceInbound', 'VoiceOutbound'],
}));

vi.mock('@/core/api/hooks/use-partner', () => ({
  useCreatePartnerRateCard: () => ({ mutate: createMutate, isPending: false }),
  useUpdatePartnerRateCard: () => ({ mutate: updateMutate, isPending: false }),
}));

import { PartnerRateCardForm } from './partner-rate-card-form';

function fillAndSubmit(currency: string) {
  fireEvent.change(screen.getByTestId('partner-rate-card-name'), { target: { value: 'Resale' } });
  fireEvent.change(screen.getByTestId('partner-rate-card-currency'), {
    target: { value: currency },
  });
  fireEvent.change(screen.getByTestId('partner-rate-card-from'), {
    target: { value: '2026-10-01T00:00' },
  });
  fireEvent.click(screen.getByTestId('partner-add-rate-entry'));
  fireEvent.click(screen.getByTestId('partner-rate-card-submit'));
}

describe('PartnerRateCardForm — ISO 4217 currency (P2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['banana', 'XYZ'])(
    'PartnerRateCardForm_ShouldBlockSubmitWithAFieldError_WhenCurrencyIs %s',
    async (currency) => {
      render(<PartnerRateCardForm open onOpenChange={vi.fn()} mode="create" />);

      fillAndSubmit(currency);

      await waitFor(() =>
        expect(screen.getByText('admin:partner.validation.currencyInvalid')).toBeInTheDocument(),
      );
      expect(createMutate).not.toHaveBeenCalled();
    },
  );

  it('PartnerRateCardForm_ShouldSendTheCanonicalCode_WhenCurrencyIsLowerCaseWithSpaces', async () => {
    render(<PartnerRateCardForm open onOpenChange={vi.fn()} mode="create" />);

    fillAndSubmit(' usd ');

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ currency: 'USD' });
  });

  it('PartnerRateCardForm_ShouldStayOpen_WhenTheWriteIsRefused', async () => {
    const onOpenChange = vi.fn();
    render(<PartnerRateCardForm open onOpenChange={onOpenChange} mode="create" />);

    fillAndSubmit('PEN');

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const options = createMutate.mock.calls[0][1] as { onSuccess?: () => void } | undefined;
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('partner-rate-card-submit')).toBeInTheDocument();

    options?.onSuccess?.();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
