import type { Page } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { availability, stubQaAvailability } from '../../helpers/qa-availability';

/**
 * Speech Analytics follows `analysisRunning` of the availability read. The availability and the three
 * `/api/v1/call-analytics/*` reads are stubbed with `page.route`, so the spec needs the signed-in
 * admin of the dev stack but no analysed call on it. `data-*` selectors only; waits through
 * `expect(...)` polling, never wall-clock waits.
 */
const CALL_ANALYTICS_URL = /\/api\/v1\/call-analytics\//;

const TOPICS = {
  trends: [{ topic: 'billing', occurrences: 3, avgConfidence: 0.8 }],
  totalAnalyzed: 3,
};
const SENTIMENT = {
  points: [
    {
      bucketStart: '2026-11-10T00:00:00Z',
      avgSentimentScore: 0.2,
      positiveCount: 1,
      neutralCount: 1,
      negativeCount: 1,
      totalCount: 3,
    },
  ],
  bucket: 'day',
  from: '2026-11-01',
  to: '2026-11-30',
};
const COMPLIANCE = {
  rules: [
    {
      ruleId: 'r1',
      ruleName: 'Card number read aloud',
      severity: 'Critical',
      occurrences: 1,
      sessionsAffected: 1,
      firstSeen: '2026-11-10T00:00:00Z',
      lastSeen: '2026-11-10T00:00:00Z',
    },
  ],
  totalViolations: 1,
  totalSessionsWithViolations: 1,
  severityBreakdown: { critical: 1, warning: 0, info: 0 },
  from: '2026-11-01',
  to: '2026-11-30',
};

async function stubCallAnalytics(page: Page, topics: unknown = TOPICS) {
  await page.route(CALL_ANALYTICS_URL, (route) => {
    const url = route.request().url();
    const body = url.includes('/topics/')
      ? topics
      : url.includes('/sentiment/')
        ? SENTIMENT
        : COMPLIANCE;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.describe('Speech Analytics — analysis runs', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await stubQaAvailability(page, availability.available());
  });

  test('shows the topics, sentiment and compliance tabs and the severity filter', async ({
    demoAdminPage: page,
  }) => {
    await stubCallAnalytics(page);
    await page.goto('/analytics/speech');

    await expect(page.getByTestId('speech-analytics-page')).toBeVisible();
    await expect(page.getByTestId('topics-tab')).toBeVisible();
    await expect(page.getByTestId('topics-table')).toBeVisible();

    await page.getByTestId('speech-tab-sentiment').click();
    await expect(page.getByTestId('sentiment-tab')).toBeVisible();

    await page.getByTestId('speech-tab-compliance').click();
    await expect(page.getByTestId('compliance-tab')).toBeVisible();
    await expect(page.getByTestId('severity-filter')).toBeVisible();
    await expect(page.getByTestId('compliance-table')).toBeVisible();
    await expect(page.getByTestId('speech-unavailable')).toHaveCount(0);
  });

  test('a period with no topic shows the empty state', async ({ demoAdminPage: page }) => {
    await stubCallAnalytics(page, { trends: [], totalAnalyzed: 0 });
    await page.goto('/analytics/speech');

    await expect(page.getByTestId('topics-tab').getByTestId('empty-state')).toBeVisible();
  });
});

test.describe('Speech Analytics — analysis does not run', () => {
  test('names the reason, shows no tab and issues no call-analytics request', async ({
    demoAdminPage: page,
  }) => {
    await stubQaAvailability(page, availability.noTranscriptSource());
    const requests: string[] = [];
    page.on('request', (req) => {
      if (CALL_ANALYTICS_URL.test(req.url())) requests.push(req.url());
    });

    await page.goto('/analytics/speech');

    await expect(page.getByTestId('speech-unavailable')).toHaveAttribute(
      'data-reason',
      'not_configured',
    );
    await expect(page.getByTestId('speech-tab-topics')).toHaveCount(0);
    await expect(page.getByTestId('topics-tab')).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});
