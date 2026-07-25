import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qrcode-svg" data-value={value} />,
}));

vi.mock('@/core/api/hooks/use-mfa-enroll', () => ({
  useMfaEnrollInit: vi.fn(),
  useMfaEnrollVerify: vi.fn(),
  useMfaEnrollComplete: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import {
  useMfaEnrollInit,
  useMfaEnrollVerify,
  useMfaEnrollComplete,
} from '@/core/api/hooks/use-mfa-enroll';
import MfaEnrollWizard from './mfa-enroll-wizard';

const mockInit = asMock(useMfaEnrollInit);
const mockVerify = asMock(useMfaEnrollVerify);
const mockComplete = asMock(useMfaEnrollComplete);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MfaEnrollWizard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Init_ShouldRenderQrCode_WhenInitResolves', async () => {
    const initData = {
      secret: 'JBSWY3DPEHPK3PXP',
      qrUri: 'otpauth://totp/test',
      manualCode: 'JBSWY3DPEHPK3PXP',
    };
    mockInit.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(initData),
      isPending: false,
      isError: false,
    });
    mockVerify.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockComplete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<MfaEnrollWizard />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('mfa-enroll-qrcode')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mfa-enroll-manual-code')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    expect(screen.getByTestId('mfa-enroll-step-qr').dataset.active).toBe('true');
  });

  it('Stepper_ShouldAdvanceToVerify_WhenNextClicked', async () => {
    const initData = { secret: 'SEC', qrUri: 'uri', manualCode: 'SEC' };
    mockInit.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(initData),
      isPending: false,
      isError: false,
    });
    mockVerify.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockComplete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<MfaEnrollWizard />, { wrapper: makeWrapper() });

    await waitFor(() => screen.getByTestId('mfa-enroll-next-verify'));
    fireEvent.click(screen.getByTestId('mfa-enroll-next-verify'));

    expect(screen.getByTestId('mfa-enroll-verify-step')).toBeInTheDocument();
    expect(screen.getByTestId('mfa-enroll-step-verify').dataset.active).toBe('true');
  });

  it('Verify_ShouldDisableSubmit_WhenTotpInputLessThan6Digits', async () => {
    const initData = { secret: 'SEC', qrUri: 'uri', manualCode: 'SEC' };
    mockInit.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(initData),
      isPending: false,
      isError: false,
    });
    mockVerify.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockComplete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<MfaEnrollWizard />, { wrapper: makeWrapper() });
    await waitFor(() => screen.getByTestId('mfa-enroll-next-verify'));
    fireEvent.click(screen.getByTestId('mfa-enroll-next-verify'));

    const input = screen.getByTestId('mfa-enroll-totp-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123' } });
    expect(screen.getByTestId('mfa-enroll-verify-submit')).toBeDisabled();

    fireEvent.change(input, { target: { value: '123456' } });
    expect(screen.getByTestId('mfa-enroll-verify-submit')).not.toBeDisabled();
  });

  it('Verify_ShouldRenderRecoveryCodes_WhenVerifyResolves', async () => {
    const initData = { secret: 'SEC', qrUri: 'uri', manualCode: 'SEC' };
    const codes = [
      'ABCD2345',
      'EFGH6789',
      'JKLM2345',
      'NPQR6789',
      'STUV2345',
      'WXYZ6789',
      'ABCD3456',
      'EFGH7890',
      'JKLM3456',
      'NPQR7890',
    ];
    mockInit.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(initData),
      isPending: false,
      isError: false,
    });
    mockVerify.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ recoveryCodes: codes }),
      isPending: false,
    });
    mockComplete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<MfaEnrollWizard />, { wrapper: makeWrapper() });
    await waitFor(() => screen.getByTestId('mfa-enroll-next-verify'));
    fireEvent.click(screen.getByTestId('mfa-enroll-next-verify'));

    fireEvent.change(screen.getByTestId('mfa-enroll-totp-input'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('mfa-enroll-verify-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('mfa-enroll-recovery-codes')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mfa-enroll-recovery-codes').textContent).toContain('ABCD2345');
  });

  it('Codes_ShouldDisableDoneButton_WhenAcknowledgeUnchecked', async () => {
    const initData = { secret: 'SEC', qrUri: 'uri', manualCode: 'SEC' };
    const codes = Array.from({ length: 10 }, (_, i) => `CODE${i}789`);
    mockInit.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(initData),
      isPending: false,
      isError: false,
    });
    mockVerify.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ recoveryCodes: codes }),
      isPending: false,
    });
    mockComplete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<MfaEnrollWizard />, { wrapper: makeWrapper() });
    await waitFor(() => screen.getByTestId('mfa-enroll-next-verify'));
    fireEvent.click(screen.getByTestId('mfa-enroll-next-verify'));
    fireEvent.change(screen.getByTestId('mfa-enroll-totp-input'), { target: { value: '123456' } });
    fireEvent.click(screen.getByTestId('mfa-enroll-verify-submit'));
    await waitFor(() => screen.getByTestId('mfa-enroll-done'));

    expect(screen.getByTestId('mfa-enroll-done')).toBeDisabled();
  });
});
