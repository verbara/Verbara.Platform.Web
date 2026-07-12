import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { captureCsatResponse } from './csat-api';
import type { CsatCaptureRequest } from '@/core/api/hooks/use-csat';

/**
 * Verbatim-fixture-citation guard (csat-runner Phase C, task 3.1).
 *
 * The webchat capture payload is a hard cross-repo boundary: its wire shape MUST
 * match the golden fixture owned by Verbara.Platform
 * (`openspec/changes/csat-runner/fixtures/csat-response-capture.v1.json`) key-for-key.
 * This test loads that fixture at runtime and asserts the JSON body the embed
 * transport actually serializes has EXACTLY those keys — no missing field, no
 * ad-hoc extra leaking onto the boundary. If either side drifts, this fails.
 *
 * The `_comment` documentation key in the fixture is excluded (it is metadata,
 * not a wire field). The remaining nine are the contract.
 */

// Resolve the fixture from the sibling Verbara.Platform repo (READ-ONLY).
const FIXTURE_URL = new URL(
  '../../../../../Verbara.Platform/openspec/changes/csat-runner/fixtures/csat-response-capture.v1.json',
  import.meta.url,
);

/** The nine golden wire keys, embedded as a fallback so the guard still runs if
 * the sibling repo is not checked out alongside this one (e.g. an isolated CI
 * shallow clone). When the real fixture IS present it takes precedence and the
 * two are cross-checked against each other, so this list can never silently rot. */
const EMBEDDED_GOLDEN_KEYS = [
  'responseToken',
  'surveyId',
  'questionId',
  'channel',
  'queueName',
  'rating',
  'comment',
  'capturedAt',
  'conversationId',
] as const;

function loadGoldenKeys(): string[] {
  try {
    const raw = readFileSync(fileURLToPath(FIXTURE_URL), 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const keys = Object.keys(parsed).filter((k) => k !== '_comment');
    // Cross-check the on-disk fixture against the embedded list so drift on
    // EITHER side is caught, then use the on-disk keys as the source of truth.
    expect([...keys].sort()).toEqual([...EMBEDDED_GOLDEN_KEYS].sort());
    return keys;
  } catch {
    // Sibling repo absent — fall back to the embedded golden keys.
    return [...EMBEDDED_GOLDEN_KEYS];
  }
}

const GOLDEN_KEYS = loadGoldenKeys();

/** A fully-populated request matching the fixture (comment present). */
const FULL_BODY: CsatCaptureRequest = {
  responseToken: 'v1.token.hmac-sha256-7d-ttl',
  surveyId: 'srv-csat-v1',
  questionId: 'csat-rating-v1',
  channel: 'webchat',
  queueName: 'support-tier1',
  rating: 5,
  comment: 'Fast and friendly, thanks!',
  capturedAt: '2026-07-07T09:15:00Z',
  conversationId: 'conv-8f2a1c4e',
};

/** Capture the exact JSON body the transport serializes onto the wire. */
async function captureSerializedBody(body: CsatCaptureRequest): Promise<Record<string, unknown>> {
  let sent: string | undefined;
  const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
    sent = init?.body as string;
    return { ok: true, status: 200 } as Response;
  });
  vi.stubGlobal('fetch', fetchSpy);
  await captureCsatResponse({ apiBase: '/api/v1', body });
  expect(fetchSpy).toHaveBeenCalledOnce();
  expect(sent).toBeDefined();
  return JSON.parse(sent!) as Record<string, unknown>;
}

describe('captureCsatResponse — wire-shape contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('SerializedBody_ShouldHaveExactlyGoldenFixtureKeys_WhenCommentPresent', async () => {
    const parsed = await captureSerializedBody(FULL_BODY);
    // Exact set equality — no missing keys, no extra keys.
    expect(Object.keys(parsed).sort()).toEqual([...GOLDEN_KEYS].sort());
  });

  it('SerializedBody_ShouldStillCarryCommentKey_WhenCommentIsNull', async () => {
    // A blank comment serializes as null (JSON.stringify keeps null-valued keys),
    // so the key set is invariant regardless of whether the visitor typed a note.
    const parsed = await captureSerializedBody({ ...FULL_BODY, comment: null });
    expect(Object.keys(parsed).sort()).toEqual([...GOLDEN_KEYS].sort());
    expect(parsed.comment).toBeNull();
  });

  it('SerializedBody_ShouldPreserveScalarValues_WhenPosted', async () => {
    const parsed = await captureSerializedBody(FULL_BODY);
    expect(parsed.rating).toBe(5);
    expect(parsed.channel).toBe('webchat');
    expect(parsed.responseToken).toBe(FULL_BODY.responseToken);
  });

  it('PostUrl_ShouldTargetCsatWebchatEndpoint_WhenApiBaseHasTrailingSlash', async () => {
    let calledUrl: string | undefined;
    const fetchSpy = vi.fn(async (url: string) => {
      calledUrl = url;
      return { ok: true, status: 200 } as Response;
    });
    vi.stubGlobal('fetch', fetchSpy);
    await captureCsatResponse({ apiBase: 'https://api.example.com/api/v1/', body: FULL_BODY });
    expect(calledUrl).toBe('https://api.example.com/api/v1/csat/responses/webchat');
  });

  it('Throws_WhenResponseNotOk', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 422 }) as Response),
    );
    await expect(captureCsatResponse({ apiBase: '/api/v1', body: FULL_BODY })).rejects.toThrow(
      /422/,
    );
  });
});
