import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useOnboardingStatus,
  useCompleteOnboarding,
  useDismissChecklist,
  useApplyTemplate,
} from './use-onboarding';
import type { OnboardingStatus } from './use-onboarding';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleStatus: OnboardingStatus = {
  wizardCompleted: false,
  templateApplied: null,
  checklist: [
    { key: 'create-queue', label: 'Create a queue', completed: false },
    { key: 'add-agent', label: 'Add an agent', completed: true },
  ],
  checklistDismissed: false,
};

describe('useOnboardingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch onboarding status', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleStatus);
    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleStatus);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/onboarding/status',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useOnboardingStatus(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Fetch failed');
  });
});

describe('useCompleteOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete onboarding', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/onboarding/complete',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Complete failed'));
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDismissChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dismiss checklist', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDismissChecklist(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/onboarding/dismiss-checklist',
      method: 'PUT',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Dismiss failed'));
    const { result } = renderHook(() => useDismissChecklist(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useApplyTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply a template', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useApplyTemplate(), { wrapper });
    act(() => {
      result.current.mutate('support');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/onboarding/apply-template',
      method: 'POST',
      data: { template: 'support' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Apply failed'));
    const { result } = renderHook(() => useApplyTemplate(), { wrapper });
    act(() => {
      result.current.mutate('sales');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
