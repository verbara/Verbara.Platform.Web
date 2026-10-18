import { Sentry } from './sentry-init';

type BreadcrumbType =
  | 'opened'
  | 'closed'
  | 'message-sent'
  | 'message-received'
  | 'reconnected'
  | 'session-created'
  | 'session-resumed'
  | 'session-abandoned'
  | 'session-unavailable'
  | 'timeout';

export function breadcrumb(type: BreadcrumbType, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({
    category: 'webchat',
    message: `webchat.${type}`,
    level: 'info',
    data,
  });
}
