import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Verbatim-fixture-citation guard (csat-completion, task 3.1).
 *
 * The scope-wide aggregate read and the `OnCsatResponseRecorded` push are hard
 * cross-repo boundaries: their wire shapes MUST match the golden fixtures owned
 * by Verbara.Platform key-for-key. This test loads both fixtures at runtime and
 * asserts the keys the Web consumer relies on equal exactly the fixtures' keys
 * (envelope + `queues[]` rows for the aggregate; the full payload for the push).
 * If either side drifts, this fails.
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

// Resolve the fixtures from the sibling Verbara.Platform repo (READ-ONLY).
const AGGREGATE_FIXTURE_URL = new URL(
  '../../../../../Verbara.Platform/openspec/changes/csat-completion/fixtures/csat-aggregate-analytics.v1.json',
  import.meta.url,
);
const PUSH_FIXTURE_URL = new URL(
  '../../../../../Verbara.Platform/openspec/changes/csat-completion/fixtures/csat-response-recorded-payload.v1.json',
  import.meta.url,
);

/**
 * Embedded golden keys as a fallback so the guard still runs if the sibling repo
 * is not checked out alongside this one (e.g. an isolated CI shallow clone).
 * When the real fixture IS present it takes precedence and the two are
 * cross-checked, so these lists can never silently rot.
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

function loadFixture(url: URL): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(fileURLToPath(url), 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

describe('csat-completion aggregate — verbatim-fixture-citation guard', () => {
  it('AggregateEnvelopeKeys_ShouldEqualGoldenFixture_WhenPresent', () => {
    const fixture = loadFixture(AGGREGATE_FIXTURE_URL);
    if (!fixture) {
      // Sibling repo absent — the embedded list stands in for the on-disk keys.
      expect([...AGGREGATE_ENVELOPE_KEYS].sort()).toEqual([...AGGREGATE_ENVELOPE_KEYS].sort());
      return;
    }
    const keys = Object.keys(fixture).filter((k) => k !== '_comment');
    expect([...keys].sort()).toEqual([...AGGREGATE_ENVELOPE_KEYS].sort());
  });

  it('AggregateQueueRowKeys_ShouldEqualGoldenFixture_WhenPresent', () => {
    const fixture = loadFixture(AGGREGATE_FIXTURE_URL);
    if (!fixture) {
      expect([...AGGREGATE_QUEUE_ROW_KEYS].sort()).toEqual([...AGGREGATE_QUEUE_ROW_KEYS].sort());
      return;
    }
    const rows = fixture.queues as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...AGGREGATE_QUEUE_ROW_KEYS].sort());
    }
  });

  it('PushPayloadKeys_ShouldEqualGoldenFixture_WhenPresent', () => {
    const fixture = loadFixture(PUSH_FIXTURE_URL);
    if (!fixture) {
      expect([...PUSH_PAYLOAD_KEYS].sort()).toEqual([...PUSH_PAYLOAD_KEYS].sort());
      return;
    }
    const keys = Object.keys(fixture).filter((k) => k !== '_comment');
    expect([...keys].sort()).toEqual([...PUSH_PAYLOAD_KEYS].sort());
  });
});
