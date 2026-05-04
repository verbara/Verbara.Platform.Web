import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import { useAuditEvents } from './use-audit-events';
import type { AuditEntry } from './use-audit-events';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockAuditEntry: AuditEntry = {
  entryId: 'ae1',
  occurredAt: '2026-01-01T00:00:00Z',
  action: 'queue.updated',
  category: 'queues',
  severity: 'info',
  actorId: 'u1',
  actorType: 'user',
  targetId: 'q1',
  targetType: 'queue',
  entityType: 'queue',
  entityId: 'q1',
  performedBy: 'admin@example.com',
  metadata: null,
  details: null,
};

describe('useAuditEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch audit events for a resource', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockAuditEntry]);
    const { result } = renderHook(
      () => useAuditEvents({ resourceType: 'queue', resourceId: 'q1' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockAuditEntry]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/audit/queue/q1',
      method: 'GET',
    });
  });

  it('should not fetch when resourceType is undefined', () => {
    const { result } = renderHook(
      () => useAuditEvents({ resourceType: undefined, resourceId: 'q1' }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should not fetch when resourceId is undefined', () => {
    const { result } = renderHook(
      () => useAuditEvents({ resourceType: 'queue', resourceId: undefined }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(
      () => useAuditEvents({ resourceType: 'queue', resourceId: 'q1' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
