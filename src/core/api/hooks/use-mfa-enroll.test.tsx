import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type {
  MfaEnrollInitResponse,
  MfaEnrollVerifyRequest,
  MfaEnrollVerifyResponse,
} from './use-mfa-enroll';
import { useMfaEnrollInit, useMfaEnrollVerify, useMfaEnrollComplete } from './use-mfa-enroll';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMfaEnrollInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/profile/security/mfa/enroll/init on mutate', async () => {
    const response: MfaEnrollInitResponse = {
      secret: 'ABCDEF',
      qrUri: 'otpauth://totp/test',
      manualCode: 'ABC-DEF',
    };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useMfaEnrollInit(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/profile/security/mfa/enroll/init',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useMfaEnrollInit(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useMfaEnrollVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/profile/security/mfa/enroll/verify with request data', async () => {
    const response: MfaEnrollVerifyResponse = { recoveryCodes: ['code1', 'code2', 'code3'] };
    vi.mocked(client.customFetch).mockResolvedValue(response);

    const { result } = renderHook(() => useMfaEnrollVerify(), { wrapper });

    const req: MfaEnrollVerifyRequest = { secret: 'ABCDEF', totpCode: '123456' };
    act(() => {
      result.current.mutate(req);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/profile/security/mfa/enroll/verify',
      method: 'POST',
      data: req,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Invalid TOTP'));

    const { result } = renderHook(() => useMfaEnrollVerify(), { wrapper });

    act(() => {
      result.current.mutate({ secret: 'X', totpCode: '000000' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Invalid TOTP');
  });
});

describe('useMfaEnrollComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/profile/security/mfa/enroll/complete with acknowledged: true', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useMfaEnrollComplete(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/profile/security/mfa/enroll/complete',
      method: 'POST',
      data: { acknowledged: true },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useMfaEnrollComplete(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Server error');
  });
});
