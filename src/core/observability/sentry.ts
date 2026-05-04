import * as Sentry from '@sentry/react';
import type { ErrorInfo } from 'react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const environment =
  (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE;
const release = import.meta.env.VITE_APP_VERSION as string | undefined;

let initialized = false;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SENSITIVE_HEADERS = ['authorization', 'x-tenant-id', 'cookie', 'set-cookie'];
const AUTH_URL_REGEX = /\/api\/v1\/auth\//;

function redactHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!headers || typeof headers !== 'object') return headers;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.includes(key.toLowerCase()) ? '[redacted]' : value;
  }
  return out;
}

function maskEmails(input: unknown): unknown {
  if (typeof input === 'string') return input.replace(EMAIL_REGEX, '[email]');
  return input;
}

export function initSentry(): void {
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment,
    release,
    sendDefaultPii: false,
    maxBreadcrumbs: 50,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    denyUrls: [AUTH_URL_REGEX],

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        const url = (breadcrumb.data?.url as string | undefined) ?? '';
        if (AUTH_URL_REGEX.test(url)) return null;
      }
      if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        const data = breadcrumb.data as Record<string, unknown>;
        if (data.headers && typeof data.headers === 'object') {
          data.headers = redactHeaders(data.headers as Record<string, unknown>);
        }
      }
      return breadcrumb;
    },

    beforeSend(event) {
      if (event.request?.url && AUTH_URL_REGEX.test(event.request.url)) {
        delete event.request.data;
      }
      if (event.request?.headers && typeof event.request.headers === 'object') {
        event.request.headers = redactHeaders(
          event.request.headers as unknown as Record<string, unknown>,
        ) as typeof event.request.headers;
      }
      if (event.message) event.message = String(maskEmails(event.message));
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((v) => ({
          ...v,
          value: typeof v.value === 'string' ? String(maskEmails(v.value)) : v.value,
        }));
      }
      return event;
    },
  });

  initialized = true;
}

export function captureAreaError(error: Error, area: string, errorInfo?: ErrorInfo): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    scope.setTag('boundary', 'area');
    scope.setTag('area', area);
    if (errorInfo?.componentStack)
      scope.setContext('react', { componentStack: errorInfo.componentStack });
    Sentry.captureException(error);
  });
}

export function captureRouteError(error: Error, errorInfo?: ErrorInfo): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    scope.setTag('boundary', 'route');
    if (errorInfo?.componentStack)
      scope.setContext('react', { componentStack: errorInfo.componentStack });
    Sentry.captureException(error);
  });
}

export function isSentryInitialized(): boolean {
  return initialized;
}

export function setSentryUser(user: { id: string; segment?: string } | null): void {
  if (!initialized) return;
  if (user === null) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, segment: user.segment });
}

export function addSentryBreadcrumb(
  category: string,
  message: string,
  level: Sentry.SeverityLevel = 'info',
): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category, message, level });
}
