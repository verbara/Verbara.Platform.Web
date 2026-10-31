import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({ data: [] }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { QueueForm } from './queue-form';

const onSubmit = vi.fn();

function renderWithWrapUp(defaultWrapUpSeconds: string) {
  render(
    <QueueForm
      open
      mode="edit"
      onOpenChange={() => {}}
      onSubmit={onSubmit}
      defaultValues={{ name: 'Support', defaultWrapUpSeconds }}
    />,
  );
}

describe('QueueForm wrap-up seconds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('QueueForm_ShouldBlockSubmitAndShowTheWrapUpTab_WhenWrapUpIsAboveTheMaximum', async () => {
    renderWithWrapUp('601');

    fireEvent.click(screen.getByTestId('queue-form-submit'));

    expect(await screen.findByTestId('queue-form-wrap-up-seconds-error')).toHaveTextContent(
      'admin:queues.validation.wrapUpSecondsRange',
    );
    expect(screen.getByTestId('queue-form-wrap-up-seconds')).toHaveAttribute('max', '600');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['0', '600'])('QueueForm_ShouldSubmit_WhenWrapUpIs %s', async (value) => {
    renderWithWrapUp(value);

    fireEvent.click(screen.getByTestId('queue-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ defaultWrapUpSeconds: value });
  });
});
