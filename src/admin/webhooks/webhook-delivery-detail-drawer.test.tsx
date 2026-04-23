import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : k,
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/core/api/hooks/use-webhooks', async () => {
  const actual = await vi.importActual<
    typeof import('@/core/api/hooks/use-webhooks')
  >('@/core/api/hooks/use-webhooks');
  return {
    ...actual,
    useRetryDeadLetter: vi.fn(),
  };
});

import { useRetryDeadLetter, type WebhookDelivery } from '@/core/api/hooks/use-webhooks';
import { WebhookDeliveryDetailDrawer } from './webhook-delivery-detail-drawer';

const mockUseRetry = useRetryDeadLetter as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

const jsonDelivery: WebhookDelivery = {
  deliveryId: 'abc123def456ghi789',
  tenantId: 'tenant-1',
  subscriptionId: 'sub-42',
  eventType: 'conversation.assigned',
  payload: '{"id":"ev1","tenantId":"t1","type":"conversation.assigned"}',
  status: 'DeadLetter',
  attempts: 8,
  maxAttempts: 8,
  nextRetryAt: null,
  lastResponseCode: 503,
  lastError: 'Upstream timed out after 10s',
  createdAt: '2026-04-20T12:00:00Z',
  deliveredAt: null,
};

describe('WebhookDeliveryDetailDrawer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseRetry.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('renders_nothing_when_delivery_is_null', () => {
    const { container } = render(
      <WebhookDeliveryDetailDrawer
        delivery={null}
        open
        onOpenChange={() => {}}
      />,
      { wrapper: makeWrapper() },
    );
    expect(container.textContent).toBe('');
  });

  it('renders_payload_and_metadata_when_delivery_is_dead_letter', () => {
    render(
      <WebhookDeliveryDetailDrawer
        delivery={jsonDelivery}
        open
        onOpenChange={() => {}}
      />,
      { wrapper: makeWrapper() },
    );

    expect(screen.getByTestId('webhook-delivery-detail-drawer')).toBeDefined();
    expect(screen.getByTestId('webhook-delivery-payload')).toBeDefined();
    expect(screen.getByTestId('webhook-delivery-last-error').textContent).toContain(
      'Upstream timed out',
    );
    // Retry action present for DeadLetter status
    expect(screen.getByTestId('webhook-delivery-retry')).toBeDefined();
  });

  it('hides_retry_action_when_delivery_is_not_dead_letter', () => {
    const delivered: WebhookDelivery = { ...jsonDelivery, status: 'Delivered' };
    render(
      <WebhookDeliveryDetailDrawer
        delivery={delivered}
        open
        onOpenChange={() => {}}
      />,
      { wrapper: makeWrapper() },
    );

    expect(screen.queryByTestId('webhook-delivery-retry')).toBeNull();
  });

  it('falls_back_to_plaintext_when_payload_is_not_valid_json', () => {
    const textDelivery: WebhookDelivery = {
      ...jsonDelivery,
      payload: 'not-json-at-all',
    };
    render(
      <WebhookDeliveryDetailDrawer
        delivery={textDelivery}
        open
        onOpenChange={() => {}}
      />,
      { wrapper: makeWrapper() },
    );

    // The payload viewer still renders — CodeBlock handles plaintext language.
    expect(screen.getByTestId('webhook-delivery-payload')).toBeDefined();
  });
});
