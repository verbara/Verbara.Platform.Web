import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/core/api/hooks/use-recovery-codes', () => ({
  useRegenerateRecoveryCodes: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import { useRegenerateRecoveryCodes } from '@/core/api/hooks/use-recovery-codes';
import RegeneratePage from './regenerate-page';

const mockRegenerate = asMock(useRegenerateRecoveryCodes);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RegeneratePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Page_ShouldRenderWarningStep_OnFirstLoad', () => {
    mockRegenerate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<RegeneratePage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('recovery-warning-step')).toBeInTheDocument();
    expect(screen.queryByTestId('recovery-codes-step')).not.toBeInTheDocument();
  });

  it('Submit_ShouldBeDisabled_WhenTotpInputIncomplete', () => {
    mockRegenerate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<RegeneratePage />, { wrapper: makeWrapper() });

    const input = screen.getByTestId('recovery-regenerate-totp-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123' } });
    expect(screen.getByTestId('recovery-regenerate-submit')).toBeDisabled();

    fireEvent.change(input, { target: { value: '123456' } });
    expect(screen.getByTestId('recovery-regenerate-submit')).not.toBeDisabled();
  });

  it('Submit_ShouldAdvanceToCodesStep_WhenRegenerateResolves', async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `CODE${i}789`);
    mockRegenerate.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ recoveryCodes: codes }),
      isPending: false,
    });

    render(<RegeneratePage />, { wrapper: makeWrapper() });

    fireEvent.change(screen.getByTestId('recovery-regenerate-totp-input'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('recovery-regenerate-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('recovery-codes-step')).toBeInTheDocument();
    });
    expect(screen.getByTestId('recovery-regenerate-codes').textContent).toContain('CODE0789');
  });

  it('Done_ShouldBeDisabled_WhenAcknowledgeUnchecked', async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `CODE${i}789`);
    mockRegenerate.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ recoveryCodes: codes }),
      isPending: false,
    });

    render(<RegeneratePage />, { wrapper: makeWrapper() });

    fireEvent.change(screen.getByTestId('recovery-regenerate-totp-input'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('recovery-regenerate-submit'));

    await waitFor(() => screen.getByTestId('recovery-regenerate-done'));
    expect(screen.getByTestId('recovery-regenerate-done')).toBeDisabled();
  });
});
