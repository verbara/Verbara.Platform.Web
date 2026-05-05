import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type NotificationRuleState = 'Active' | 'Paused';

export type NotificationChannel = 'Email' | 'SMS' | 'Push' | 'Webhook' | 'InApp';

export type NotificationSeverity = 'Info' | 'Warning' | 'Critical';

export interface RuleTriggerConfig {
  eventType: string;
  subConditions: Record<string, unknown>;
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

export interface RuleAction {
  channel: NotificationChannel;
  config: Record<string, unknown>;
}

export interface RuleSchedule {
  mode: 'always' | 'business_hours' | 'custom';
  timezone?: string;
  windows?: { days: number[]; startTime: string; endTime: string }[];
}

export interface RuleThrottling {
  maxPerPeriod: number;
  periodUnit: 'hour' | 'day';
  cooldownMinutes: number;
}

export interface NotificationRule {
  ruleId: string;
  tenantId: string;
  name: string;
  description?: string;
  eventType: string;
  channels: NotificationChannel[];
  severity: NotificationSeverity;
  recipients: string[];
  state: NotificationRuleState;
  lastFiredAt: string | null;
  trigger: RuleTriggerConfig;
  conditions: RuleCondition[];
  actions: RuleAction[];
  schedule: RuleSchedule;
  throttling: RuleThrottling;
  createdAt: string;
  updatedAt: string;
}

export interface DryRunResult {
  estimatedFireCount: number;
  matchingEvents: { eventId: string; eventType: string; occurredAt: string; summary: string }[];
  estimatedRecipients: string[];
}

export interface RuleFiringEntry {
  firingId: string;
  ruleId: string;
  eventSnapshot: Record<string, unknown>;
  channelsNotified: { channel: NotificationChannel; success: boolean; error?: string }[];
  firedAt: string;
}

export interface NotificationEventType {
  eventType: string;
  description: string;
  category: string;
  subConditionSchema: Record<string, unknown>;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useNotificationRules() {
  return useQuery({
    queryKey: ['notification-rules'],
    queryFn: () =>
      customFetch<NotificationRule[]>({
        url: '/api/v1/notification-rules',
        method: 'GET',
      }),
  });
}

export function useNotificationRule(id: string | undefined) {
  return useQuery({
    queryKey: ['notification-rule', id],
    queryFn: () =>
      customFetch<NotificationRule>({
        url: `/api/v1/notification-rules/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useCreateNotificationRule() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<NotificationRule>) =>
      customFetch<NotificationRule>({
        url: '/api/v1/notification-rules',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success(t('toasts.notificationRules.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateNotificationRule() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NotificationRule> }) =>
      customFetch<NotificationRule>({
        url: `/api/v1/notification-rules/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      qc.invalidateQueries({ queryKey: ['notification-rule', id] });
      toast.success(t('toasts.notificationRules.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteNotificationRule() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/notification-rules/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success(t('toasts.notificationRules.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePauseNotificationRule() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/notification-rules/${id}/pause`,
        method: 'PUT',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      qc.invalidateQueries({ queryKey: ['notification-rule', id] });
      toast.success(t('toasts.notificationRules.paused'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateNotificationRule() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/notification-rules/${id}/activate`,
        method: 'PUT',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      qc.invalidateQueries({ queryKey: ['notification-rule', id] });
      toast.success(t('toasts.notificationRules.activated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDryRunNotificationRule() {
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<DryRunResult>({
        url: `/api/v1/notification-rules/${id}/dry-run`,
        method: 'POST',
      }),
  });
}

export function useRuleFiringHistory(ruleId: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['rule-firing-history', ruleId, page, pageSize],
    queryFn: () =>
      customFetch<PagedResult<RuleFiringEntry>>({
        url: `/api/v1/notification-rules/${ruleId}/history`,
        method: 'GET',
        params: { page: String(page), pageSize: String(pageSize) },
      }),
    enabled: !!ruleId,
    placeholderData: (prev) => prev,
  });
}

export function useNotificationEventTypes() {
  return useQuery({
    queryKey: ['notification-event-types'],
    queryFn: () =>
      customFetch<NotificationEventType[]>({
        url: '/api/v1/notification-rules/event-types',
        method: 'GET',
      }),
    staleTime: 60 * 60 * 1000,
  });
}
