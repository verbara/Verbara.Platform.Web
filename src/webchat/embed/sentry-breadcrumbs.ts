import { Sentry } from './sentry-init';

type BreadcrumbType =
  | 'opened'
  | 'closed'
  | 'message-sent'
  | 'message-received'
  | 'reconnected'
  | 'session-created'
  | 'timeout';

export function breadcrumb(type: BreadcrumbType, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({
    category: 'webchat',
    message: `webchat.${type}`,
    level: 'info',
    data,
  });
}
