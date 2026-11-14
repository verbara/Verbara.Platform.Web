import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';

/**
 * The QA availability read (`GET /api/v1/analytics/qa-availability`, host change
 * qa-scores-are-produced-or-not-shown) stubbed from the host contract fixtures, which the unit
 * tests read too. A spec picks the deployment it needs; the console hides or shows its QA and
 * Speech Analytics surfaces from this one answer.
 */
const FIXTURES = resolve(process.cwd(), 'src/core/api/hooks/__fixtures__');

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8')) as Record<string, unknown>;
}

export const availability = {
  /** No transcript source: nothing runs, nothing is shown. */
  noTranscriptSource: () => fixture('qa-availability.v1.json'),
  /** The licence lacks call analytics. */
  notLicensed: () => fixture('qa-availability.not-licensed.v1.json'),
  /** Analysis runs and a scorecard applies: every surface is shown. */
  available: () => fixture('qa-availability.available.v1.json'),
  /** Analysis runs without a scorecard: Speech Analytics yes, QA no. */
  noScorecard: () => ({
    ...fixture('qa-availability.available.v1.json'),
    available: false,
    reason: 'no_scorecard',
  }),
};

export const qaListFixture = (): string =>
  readFileSync(resolve(FIXTURES, 'qa-list-response.v1.json'), 'utf-8');

export const QA_AVAILABILITY_URL = '**/api/v1/analytics/qa-availability';

export async function stubQaAvailability(page: Page, body: Record<string, unknown>) {
  await page.route(QA_AVAILABILITY_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}
