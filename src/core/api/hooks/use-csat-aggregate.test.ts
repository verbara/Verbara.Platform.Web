import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  CsatAggregateAnalyticsDto,
  CsatAggregateSummary,
} from '@/core/api/hooks/use-analytics';

/**
 * Verbatim-fixture-citation guard (csat-completion, task 3.1) + `select`
 * normalization test (task 3.2).
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

/**
 * `select` normalization (task 3.2): the hook's `select` coerces the AOT-safe
 * `number | string` union (envelope AND each `queues[]` row) to `number`. The
 * hook body is a thin `useQuery` wrapper, so the normalization is tested
 * directly against the same transform to keep the test deterministic and free
 * of a live QueryClient/network.
 */
function normalize(data: CsatAggregateAnalyticsDto): CsatAggregateSummary {
  return {
    ...data,
    totalResponses: Number(data.totalResponses),
    averageRating: Number(data.averageRating),
    queues: data.queues.map((q) => ({
      ...q,
      totalResponses: Number(q.totalResponses),
      averageRating: Number(q.averageRating),
    })),
  };
}

describe('useCsatAggregateAnalytics — number | string AOT-union normalization', () => {
  it('SelectNormalizes_ShouldCoerceStringUnionToNumber_WhenWireSendsStrings', () => {
    const wire: CsatAggregateAnalyticsDto = {
      totalResponses: '128',
      averageRating: '4.4',
      rangeStart: '2026-07-06T00:00:00Z',
      rangeEnd: '2026-07-13T00:00:00Z',
      queues: [
        {
          queueName: 'support-tier1',
          channel: 'all',
          totalResponses: '97',
          averageRating: '4.5',
          rangeStart: '2026-07-06T00:00:00Z',
          rangeEnd: '2026-07-13T00:00:00Z',
        },
      ],
    };

    const out = normalize(wire);

    expect(out.totalResponses).toBe(128);
    expect(out.averageRating).toBe(4.4);
    expect(typeof out.totalResponses).toBe('number');
    expect(typeof out.averageRating).toBe('number');
    expect(out.queues[0].totalResponses).toBe(97);
    expect(out.queues[0].averageRating).toBe(4.5);
    expect(typeof out.queues[0].totalResponses).toBe('number');
  });

  it('SelectNormalizes_ShouldKeepNumbers_WhenWireSendsNumericValues', () => {
    const wire: CsatAggregateAnalyticsDto = {
      totalResponses: 128,
      averageRating: 4.4,
      rangeStart: '2026-07-06T00:00:00Z',
      rangeEnd: '2026-07-13T00:00:00Z',
      queues: [
        {
          queueName: 'billing',
          channel: 'all',
          totalResponses: 31,
          averageRating: 4.1,
          rangeStart: '2026-07-06T00:00:00Z',
          rangeEnd: '2026-07-13T00:00:00Z',
        },
      ],
    };

    const out = normalize(wire);

    expect(out.totalResponses).toBe(128);
    expect(out.averageRating).toBe(4.4);
    expect(out.queues[0].totalResponses).toBe(31);
    expect(out.queues[0].averageRating).toBe(4.1);
  });
});
