import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

// --- Types ---

export interface WebhookSubscription {
  subscriptionId: string;
  tenantId: string;
  name: string;
  endpointUrl: string;
  secret: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookSubscriptionRequest {
  name: string;
  endpointUrl: string;
  eventTypes: string[];
}

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
  return useMutation({
    mutationFn: (data: CreateWebhookSubscriptionRequest) =>
      customFetch<WebhookSubscription>({
        url: '/api/v1/webhooks/subscriptions',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook subscription created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWebhookSubscription() {
  const qc = useQueryClient();
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
      toast.success('Webhook subscription updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWebhookSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/webhooks/subscriptions/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook subscription deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTestWebhookSubscription() {
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/webhooks/subscriptions/${id}/test`,
        method: 'POST',
      }),
    onSuccess: () => {
      toast.success('Test event queued');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRotateWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<WebhookSubscription>({
        url: `/api/v1/webhooks/subscriptions/${id}/rotate-secret`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['webhook', id] });
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Secret rotated');
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
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/management/webhooks/dead-letter/${id}/retry`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhook-dead-letter'] });
      toast.success('Delivery re-enqueued');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
