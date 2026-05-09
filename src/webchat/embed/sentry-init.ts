import * as Sentry from '@sentry/react';

export function initWebchatSentry(): void {
  const dsn = (import.meta.env.VITE_SENTRY_DSN_WEBCHAT as string | undefined) ?? '';
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    initialScope: { tags: { surface: 'webchat' } },
    beforeBreadcrumb(crumb) {
      // Drop URLs that may contain sensitive params
      if (crumb.category === 'fetch' && crumb.data?.url?.includes('/auth/')) return null;
      return crumb;
    },
    beforeSend(event) {
      // Mask emails in messages
      if (event.message) {
        event.message = event.message.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
      }
      return event;
    },
  });
}

export { Sentry };
