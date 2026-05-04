import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import {
  useWebhookSubscriptions,
  useWebhookSubscription,
  useCreateWebhookSubscription,
  useUpdateWebhookSubscription,
  useDeleteWebhookSubscription,
  useTestWebhookSubscription,
  useRotateWebhookSecret,
  useWebhookDeliveries,
  useWebhookEventTypes,
  useWebhookDeadLetter,
  useRetryDeadLetter,
  useCircuitStatus,
  useResetCircuit,
} from './use-webhooks';
import type { WebhookSubscription, WebhookEventType, WebhookDelivery } from './use-webhooks';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockSubscription: WebhookSubscription = {
  subscriptionId: 'ws1',
  tenantId: 't1',
  name: 'My Webhook',
  endpointUrl: 'https://example.com/webhook',
  secret: 'secret123',
  eventTypes: ['call.completed'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockEventType: WebhookEventType = {
  eventType: 'call.completed',
  description: 'Fired when a call completes',
};

const mockDelivery: WebhookDelivery = {
  deliveryId: 'd1',
  tenantId: 't1',
  subscriptionId: 'ws1',
  eventType: 'call.completed',
  payload: '{}',
  status: 'delivered',
  attempts: 1,
  maxAttempts: 3,
  nextRetryAt: null,
  lastResponseCode: 200,
  lastError: null,
  createdAt: '2026-01-01T00:00:00Z',
  deliveredAt: '2026-01-01T00:00:01Z',
};

describe('useWebhookSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch subscriptions', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockSubscription]);
    const { result } = renderHook(() => useWebhookSubscriptions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockSubscription]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useWebhookSubscriptions(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useWebhookSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single subscription', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSubscription);
    const { result } = renderHook(() => useWebhookSubscription('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSubscription);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1',
      method: 'GET',
    });
  });

  it('should not fetch when id is empty string', () => {
    const { result } = renderHook(() => useWebhookSubscription(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useWebhookSubscription('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateWebhookSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a subscription', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSubscription);
    const { result } = renderHook(() => useCreateWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate({
        name: 'My Webhook',
        endpointUrl: 'https://example.com/webhook',
        eventTypes: ['call.completed'],
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions',
      method: 'POST',
      data: {
        name: 'My Webhook',
        endpointUrl: 'https://example.com/webhook',
        eventTypes: ['call.completed'],
      },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useCreateWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'X', endpointUrl: 'https://x.com', eventTypes: [] });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateWebhookSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a subscription', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSubscription);
    const { result } = renderHook(() => useUpdateWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'ws1', data: { name: 'Updated' } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1',
      method: 'PUT',
      data: { name: 'Updated' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUpdateWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'ws1', data: { name: 'X' } });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteWebhookSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a subscription', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDeleteWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTestWebhookSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a test event', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useTestWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1/test',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useTestWebhookSubscription(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRotateWebhookSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rotate secret', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockSubscription);
    const { result } = renderHook(() => useRotateWebhookSecret(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1/rotate-secret',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRotateWebhookSecret(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useWebhookDeliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch deliveries for a subscription', async () => {
    const pagedResult = { items: [mockDelivery], totalCount: 1, page: 1, pageSize: 20 };
    vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
    const { result } = renderHook(() => useWebhookDeliveries('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(pagedResult);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1/deliveries',
      method: 'GET',
      params: { page: '1', pageSize: '20' },
    });
  });

  it('should not fetch when id is empty string', () => {
    const { result } = renderHook(() => useWebhookDeliveries(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useWebhookDeliveries('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useWebhookEventTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch event types', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockEventType]);
    const { result } = renderHook(() => useWebhookEventTypes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockEventType]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/event-types',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useWebhookEventTypes(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useWebhookDeadLetter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dead letter deliveries', async () => {
    const pagedResult = { items: [mockDelivery], totalCount: 1, page: 1, pageSize: 20 };
    vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
    const { result } = renderHook(() => useWebhookDeadLetter('t1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(pagedResult);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/webhooks/dead-letter',
      method: 'GET',
      params: { tenantId: 't1', page: '1', pageSize: '20' },
    });
  });

  it('should not fetch when tenantId is empty string', () => {
    const { result } = renderHook(() => useWebhookDeadLetter(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useWebhookDeadLetter('t1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRetryDeadLetter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry a dead letter delivery', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRetryDeadLetter(), { wrapper });
    act(() => {
      result.current.mutate('d1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/webhooks/dead-letter/d1/retry',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRetryDeadLetter(), { wrapper });
    act(() => {
      result.current.mutate('d1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCircuitStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch circuit breaker status', async () => {
    const mockStatus = {
      state: 'Closed' as const,
      failureCount: 0,
      lastFailureAt: null,
      nextRetryAt: null,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockStatus);
    const { result } = renderHook(() => useCircuitStatus('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStatus);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1/circuit-status',
      method: 'GET',
    });
  });

  it('should not fetch when subscriptionId is undefined', () => {
    const { result } = renderHook(() => useCircuitStatus(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useCircuitStatus('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useResetCircuit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reset circuit breaker', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useResetCircuit(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/webhooks/subscriptions/ws1/reset-circuit',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useResetCircuit(), { wrapper });
    act(() => {
      result.current.mutate('ws1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
