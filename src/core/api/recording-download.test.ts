import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A recording's bytes never come from the browser's HTTP cache (change `cdr-list-reads-its-envelope`;
 * host `call-records-are-written-once` B.8d, design D19): the player's stream fetch and the archive
 * download both send `cache: 'no-store'`, and so does the single retry after a 401.
 */

type RecordingModule = typeof import('./recording-download');
type AuthStoreModule = typeof import('@/core/auth/auth-store');

const STREAM_URL = '/api/v1/recordings/s-1/stream';
const REFRESH_URL = '/api/v1/auth/refresh';
const USER = { id: 'u1', email: 'op@example.com', displayName: 'Op', role: 'Admin' };

function farExpiry(): number {
  return Date.now() + 10 * 60_000;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function audio(): Response {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'Content-Type': 'audio/wav' },
  });
}

interface StreamCall {
  url: string;
  init: RequestInit | undefined;
}

let streamCalls: StreamCall[];

/** A Platform that answers the stream with audio, or with 401 for the tokens in `rejected`. */
function stubFetch(rejected: Set<string> = new Set()): ReturnType<typeof vi.fn> {
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === REFRESH_URL) {
      return json({ accessToken: 'new-token', expiresAt: new Date(farExpiry()).toISOString() });
    }
    streamCalls.push({ url: url.pathname, init });
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const token = headers.Authorization?.replace('Bearer ', '') ?? '';
    return rejected.has(token) ? json({}, 401) : audio();
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

async function load(token: string): Promise<{ recording: RecordingModule; auth: AuthStoreModule }> {
  vi.resetModules();
  const auth = await import('@/core/auth/auth-store');
  const recording = await import('./recording-download');
  auth.useAuthStore.getState().setAuth(token, farExpiry(), USER, 'tenant-1', [], {});
  return { recording, auth };
}

describe('recording fetches bypass the browser HTTP cache', () => {
  beforeEach(() => {
    streamCalls = [];
    Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetchRecording_ShouldSendNoStore_WhenThePlayerLoadsTheStream', async () => {
    stubFetch();
    const { recording } = await load('tok');

    const blob = await recording.fetchRecording(STREAM_URL);

    expect(blob.size).toBe(3);
    expect(streamCalls).toHaveLength(1);
    expect(streamCalls[0]?.url).toBe(STREAM_URL);
    expect(streamCalls[0]?.init?.cache).toBe('no-store');
  });

  it('downloadRecording_ShouldSendNoStore_WhenTheArchiveSavesARecording', async () => {
    stubFetch();
    const { recording } = await load('tok');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await recording.downloadRecording(STREAM_URL, 's-1');

    expect(streamCalls).toHaveLength(1);
    expect(streamCalls[0]?.init?.cache).toBe('no-store');
  });

  it('fetchRecording_ShouldSendNoStoreOnTheRetry_WhenTheFirstAttemptIsRefusedWith401', async () => {
    const fetch = stubFetch(new Set(['old-token']));
    const { recording, auth } = await load('old-token');

    const blob = await recording.fetchRecording(STREAM_URL);

    expect(blob.size).toBe(3);
    expect(auth.useAuthStore.getState().accessToken).toBe('new-token');
    expect(fetch.mock.calls.some(([u]) => String(u).endsWith(REFRESH_URL))).toBe(true);
    expect(streamCalls).toHaveLength(2);
    expect(streamCalls.map((c) => c.init?.cache)).toEqual(['no-store', 'no-store']);
    const retryHeaders = (streamCalls[1]?.init?.headers ?? {}) as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-token');
  });
});
