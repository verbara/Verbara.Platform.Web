import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// --- Types ---

/** Server response is the named `WebhookSubscription` schema (openapi-response-adoption,
 *  Platform/ADR-0035). The generated DTO is a superset of the former hand-written interface —
 *  it additionally carries the flattened circuit-breaker snapshot (`circuitStatus`,
 *  `circuitFailures`, `circuitOpenedAt`, `circuitNextProbeAt`, `circuitProbeAttempts`) — so the
 *  alias is a pure widening; no consumer reads a field the DTO lacks. Re-exported under the same
 *  name so callers are unchanged. */
export type WebhookSubscription = components['schemas']['WebhookSubscription'];

/**
 * Body for `POST /api/v1/webhooks/subscriptions`. Sourced from the generated
 * `components['schemas']['CreateWebhookSubscriptionRequest']`
 * (`src/core/api/generated/openapi.d.ts`, openapi-typed-client-admin), not
 * hand-declared — it is a verbatim structural match for the former hand-written
 * interface (`name`, `endpointUrl`, `eventTypes`, all required), so `tsc -b` now
 * catches any upstream drift. Re-exported under the same name so callers are
 * unchanged. (The sibling `UpdateWebhookSubscriptionRequest` stays hand-written:
 * its generated counterpart turns every optional field into required-nullable
 * `null | T` — a breaking tightening — see tasks.md.)
 */
export type CreateWebhookSubscriptionRequest =
  components['schemas']['CreateWebhookSubscriptionRequest'];

export interface UpdateWebhookSubscriptionRequest {
  name?: string;
  endpointUrl?: string;
  eventTypes?: string[];
  isActive?: boolean;
}

export interface WebhookEventType {
  eventType: string;
  description: string;
}

export interface WebhookDelivery {
  deliveryId: string;
  tenantId: string;
  subscriptionId: string;
  eventType: string;
  payload: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lastResponseCode: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- Subscriptions ---

export function useWebhookSubscriptions() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () =>
      customFetch<WebhookSubscription[]>({
        url: '/api/v1/webhooks/subscriptions',
        method: 'GET',
      }),
  });
}

export function useWebhookSubscription(id: string) {
  return useQuery({
    queryKey: ['webhook', id],
    queryFn: () =>
      customFetch<WebhookSubscription>({
        url: `/api/v1/webhooks/subscriptions/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useCreateWebhookSubscription() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateWebhookSubscriptionRequest) =>
      customFetch<WebhookSubscription>({
        url: '/api/v1/webhooks/subscriptions',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success(t('toasts.webhooks.subscriptionCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWebhookSubscription() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookSubscriptionRequest }) =>
      customFetch<WebhookSubscription>({
        url: `/api/v1/webhooks/subscriptions/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      qc.invalidateQueries({ queryKey: ['webhook', id] });
      toast.success(t('toasts.webhooks.subscriptionUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWebhookSubscription() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/webhooks/subscriptions/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success(t('toasts.webhooks.subscriptionDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTestWebhookSubscription() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/webhooks/subscriptions/${id}/test`,
        method: 'POST',
      }),
    onSuccess: () => {
      toast.success(t('toasts.webhooks.testEventQueued'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRotateWebhookSecret() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<WebhookSubscription>({
        url: `/api/v1/webhooks/subscriptions/${id}/rotate-secret`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['webhook', id] });
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success(t('toasts.webhooks.secretRotated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Deliveries ---

export function useWebhookDeliveries(id: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['webhook-deliveries', id, page, pageSize],
    queryFn: () =>
      customFetch<PagedResult<WebhookDelivery>>({
        url: `/api/v1/webhooks/subscriptions/${id}/deliveries`,
        method: 'GET',
        params: { page: String(page), pageSize: String(pageSize) },
      }),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
}

// --- Event Types ---

export function useWebhookEventTypes() {
  return useQuery({
    queryKey: ['webhook-event-types'],
    queryFn: () =>
      customFetch<WebhookEventType[]>({
        url: '/api/v1/webhooks/event-types',
        method: 'GET',
      }),
    staleTime: 60 * 60 * 1000,
  });
}

// --- Management: Dead Letter Queue ---

export function useWebhookDeadLetter(tenantId: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['webhook-dead-letter', tenantId, page, pageSize],
    queryFn: () =>
      customFetch<PagedResult<WebhookDelivery>>({
        url: '/api/v1/management/webhooks/dead-letter',
        method: 'GET',
        params: { tenantId, page: String(page), pageSize: String(pageSize) },
      }),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
}

export function useRetryDeadLetter() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/management/webhooks/dead-letter/${id}/retry`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhook-dead-letter'] });
      toast.success(t('toasts.webhooks.deliveryReEnqueued'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Circuit Breaker ---

/**
 * Server response is the named `CircuitStatusResponse` schema (openapi-response-adoption,
 * Platform/ADR-0035) — the emitted shape of `GET /webhooks/subscriptions/{id}/circuit-status`.
 * The former hand-written `CircuitBreakerStatus` used pre-contract field names
 * (`state`/`failureCount`/`lastFailureAt`/`nextRetryAt`) that never matched the wire; the DTO
 * carries the same information as `status`/`failures`/`openedAt`/`nextProbeAt` (+`subscriptionId`,
 * `probeAttempts`). Re-exported under the same name so the identifier is unchanged; the single
 * consumer (`webhook-detail-sheet.tsx`) was updated to the generated field names. `failures` /
 * `probeAttempts` are the AOT-safe `number | string` wire union — coerce with `Number(...)` at the
 * numeric read site (the JSON payload always sends a numeric value).
 */
export type CircuitBreakerStatus = components['schemas']['CircuitStatusResponse'];

export function useCircuitStatus(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ['webhook-circuit', subscriptionId],
    queryFn: () =>
      customFetch<CircuitBreakerStatus>({
        url: `/api/v1/webhooks/subscriptions/${subscriptionId}/circuit-status`,
        method: 'GET',
      }),
    enabled: !!subscriptionId,
  });
}

export function useResetCircuit() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (subscriptionId: string) =>
      customFetch<void>({
        url: `/api/v1/webhooks/subscriptions/${subscriptionId}/reset-circuit`,
        method: 'POST',
      }),
    onSuccess: (_data, subscriptionId) => {
      qc.invalidateQueries({ queryKey: ['webhook-circuit', subscriptionId] });
      toast.success(t('toasts.webhooks.circuitBreakerReset'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
