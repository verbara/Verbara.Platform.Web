import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-billing', () => ({
  useCreateRateCard: () => ({ mutate: createMutate, isPending: false }),
  useUpdateRateCard: () => ({ mutate: updateMutate, isPending: false }),
  USAGE_TYPES: ['VoiceInbound', 'VoiceOutbound'],
}));

import { RateCardForm } from './rate-card-form';

function fillAndSubmit(currency: string) {
  fireEvent.change(screen.getByTestId('rate-card-name'), { target: { value: 'Base' } });
  fireEvent.change(screen.getByTestId('rate-card-currency'), { target: { value: currency } });
  fireEvent.change(screen.getByTestId('rate-card-from'), {
    target: { value: '2026-10-01T00:00' },
  });
  fireEvent.click(screen.getByTestId('add-rate-entry'));
  fireEvent.click(screen.getByTestId('rate-card-submit'));
}

describe('RateCardForm — ISO 4217 currency (P2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['banana', 'XYZ'])(
    'RateCardForm_ShouldBlockSubmitWithAFieldError_WhenCurrencyIs %s',
    async (currency) => {
      render(<RateCardForm open onOpenChange={vi.fn()} mode="create" />);

      fillAndSubmit(currency);

      await waitFor(() =>
        expect(screen.getByText('admin:billing.validation.currencyInvalid')).toBeInTheDocument(),
      );
      expect(createMutate).not.toHaveBeenCalled();
    },
  );

  it('RateCardForm_ShouldSendTheCanonicalCode_WhenCurrencyIsLowerCaseWithSpaces', async () => {
    render(<RateCardForm open onOpenChange={vi.fn()} mode="create" />);

    fillAndSubmit(' usd ');

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ currency: 'USD' });
  });

  it('RateCardForm_ShouldStayOpen_WhenTheWriteIsRefused', async () => {
    const onOpenChange = vi.fn();
    render(<RateCardForm open onOpenChange={onOpenChange} mode="create" />);

    fillAndSubmit('PEN');

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const options = createMutate.mock.calls[0][1] as { onSuccess?: () => void } | undefined;
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('rate-card-submit')).toBeInTheDocument();

    options?.onSuccess?.();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
