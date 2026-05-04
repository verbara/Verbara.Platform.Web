import * as Sentry from '@sentry/react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { isSentryInitialized } from './sentry';

const RATING_LEVEL: Record<Metric['rating'], Sentry.SeverityLevel> = {
  good: 'info',
  'needs-improvement': 'warning',
  poor: 'error',
};

let started = false;

function sendMetric(metric: Metric): void {
  if (!isSentryInitialized()) return;
  Sentry.addBreadcrumb({
    category: 'web-vital',
    message: `${metric.name}=${metric.value.toFixed(2)} (${metric.rating})`,
    level: RATING_LEVEL[metric.rating],
    data: {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    },
  });
  if (metric.rating === 'poor') {
    Sentry.captureMessage(`Web vital ${metric.name} = ${metric.value.toFixed(2)} (poor)`, {
      level: 'warning',
      tags: {
        'web-vital': metric.name,
        rating: metric.rating,
        nav_type: metric.navigationType,
      },
      extra: {
        value: metric.value,
        delta: metric.delta,
        id: metric.id,
      },
    });
  }
}

export function initWebVitals(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  onCLS(sendMetric);
  onFCP(sendMetric);
  onINP(sendMetric);
  onLCP(sendMetric);
  onTTFB(sendMetric);
}
