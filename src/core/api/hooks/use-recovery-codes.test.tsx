import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { RegenerateRecoveryCodesRequest, RecoveryCodesPayload } from './use-recovery-codes';
import { useRegenerateRecoveryCodes } from './use-recovery-codes';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useRegenerateRecoveryCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/profile/security/recovery-codes/regenerate with totpCode', async () => {
    const response: RecoveryCodesPayload = { recoveryCodes: ['AAA-111', 'BBB-222', 'CCC-333'] };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useRegenerateRecoveryCodes(), { wrapper });

    const req: RegenerateRecoveryCodesRequest = { totpCode: '123456' };
    act(() => {
      result.current.mutate(req);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/profile/security/recovery-codes/regenerate',
      method: 'POST',
      data: req,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('MFA step-up required'));

    const { result } = renderHook(() => useRegenerateRecoveryCodes(), { wrapper });

    act(() => {
      result.current.mutate({ totpCode: '000000' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('MFA step-up required');
  });
});
