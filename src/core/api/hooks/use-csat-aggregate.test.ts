import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Verbatim-fixture-citation guard (csat-completion, task 3.1).
 *
 * The scope-wide aggregate read and the `OnCsatResponseRecorded` push are hard
 * cross-repo boundaries: their wire shapes MUST match the golden fixtures under
 * `tests/fixtures/contracts/` key-for-key. This test loads both fixtures at
 * runtime and asserts the keys the Web consumer relies on equal exactly the
 * fixtures' keys (envelope + `queues[]` rows for the aggregate; the full payload
 * for the push). If either side drifts, this fails.
 *
 * Each fixture's `_comment` documentation key is metadata, not a wire field, and
 * is excluded. The remaining keys are the contract.
 *
 * NOTE: the former `select`-normalization test (task 3.2) is retired — the AOT
 * `number | string` wire union is now extinct at the source
 * (openapi-numeric-schema-truth, Platform/ADR-0036), so `totalResponses` /
 * `averageRating` are single-typed `number` on the generated `CsatAggregateDto` and
 * the hook returns it directly with no boundary coercion to test.
 */

// Resolved from the repo root (vitest's cwd) — `import.meta.url` is not a
// `file:` URL under the jsdom environment.
const AGGREGATE_FIXTURE_PATH = resolve(
  process.cwd(),
  'tests/fixtures/contracts/csat-aggregate-analytics.v1.json',
);
const PUSH_FIXTURE_PATH = resolve(
  process.cwd(),
  'tests/fixtures/contracts/csat-response-recorded-payload.v1.json',
);

/**
 * The golden keys, embedded so the fixture file and the consumer are cross-checked
 * against each other: drift on EITHER side fails the guard.
 */
const AGGREGATE_ENVELOPE_KEYS = [
  'totalResponses',
  'averageRating',
  'rangeStart',
  'rangeEnd',
  'queues',
] as const;

const AGGREGATE_QUEUE_ROW_KEYS = [
  'queueName',
  'channel',
  'totalResponses',
  'averageRating',
  'rangeStart',
  'rangeEnd',
] as const;

const PUSH_PAYLOAD_KEYS = [
  'tenantId',
  'responseId',
  'surveyId',
  'conversationId',
  'channel',
  'queueName',
  'rating',
  'comment',
  'capturedAt',
] as const;

function loadFixture(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

describe('csat-completion aggregate — verbatim-fixture-citation guard', () => {
  it('AggregateEnvelopeKeys_ShouldEqualGoldenFixture', () => {
    const fixture = loadFixture(AGGREGATE_FIXTURE_PATH);
    const keys = Object.keys(fixture).filter((k) => k !== '_comment');
    expect([...keys].sort()).toEqual([...AGGREGATE_ENVELOPE_KEYS].sort());
  });

  it('AggregateQueueRowKeys_ShouldEqualGoldenFixture', () => {
    const fixture = loadFixture(AGGREGATE_FIXTURE_PATH);
    const rows = fixture.queues as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...AGGREGATE_QUEUE_ROW_KEYS].sort());
    }
  });

  it('PushPayloadKeys_ShouldEqualGoldenFixture', () => {
    const fixture = loadFixture(PUSH_FIXTURE_PATH);
    const keys = Object.keys(fixture).filter((k) => k !== '_comment');
    expect([...keys].sort()).toEqual([...PUSH_PAYLOAD_KEYS].sort());
  });
});
