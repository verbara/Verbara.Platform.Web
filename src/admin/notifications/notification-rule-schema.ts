import { z } from 'zod';

export const ruleConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.string().min(1),
});

export const ruleActionSchema = z.object({
  channel: z.enum(['Email', 'SMS', 'Push', 'Webhook', 'InApp']),
  config: z.record(z.string(), z.unknown()),
});

export const ruleScheduleSchema = z.object({
  mode: z.enum(['always', 'business_hours', 'custom']),
  timezone: z.string().optional(),
  windows: z
    .array(
      z.object({
        days: z.array(z.number().min(0).max(6)),
        startTime: z.string(),
        endTime: z.string(),
      }),
    )
    .optional(),
});

export const ruleThrottlingSchema = z.object({
  maxPerPeriod: z.number().min(1),
  periodUnit: z.enum(['hour', 'day']),
  cooldownMinutes: z.number().min(0),
});

export const notificationRuleSchema = z.object({
  name: z.string().min(1, 'admin:notifications.rules.validation.nameRequired'),
  description: z.string().optional(),
  eventType: z.string().min(1, 'admin:notifications.rules.validation.eventTypeRequired'),
  subConditions: z.record(z.string(), z.unknown()),
  conditions: z.array(ruleConditionSchema),
  actions: z.array(ruleActionSchema).min(1, 'admin:notifications.rules.validation.channelRequired'),
  schedule: ruleScheduleSchema,
  throttling: ruleThrottlingSchema,
});

export type NotificationRuleFormValues = z.infer<typeof notificationRuleSchema>;
