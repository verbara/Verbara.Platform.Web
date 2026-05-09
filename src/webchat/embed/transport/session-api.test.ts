import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, fetchHistory } from './session-api';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('session-api', () => {
  it('CreateSession_PostsToTenant_AndReturnsSessionInfo', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ sessionId: 'abc', wsUrl: '/ws/webchat/abc' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as never;
    const result = await createSession({
      apiBase: '/api/v1',
      tenantId: 't1',
      visitorId: 'v1',
      profile: { name: 'Jane', email: 'jane@x.com' },
      pageContext: { url: '/x', title: 'X', referrer: '' },
    });
    expect(result).toEqual({ sessionId: 'abc', wsUrl: '/ws/webchat/abc' });
    expect(
      (globalThis.fetch as never as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0],
    ).toContain('/api/v1/webchat/sessions');
  });

  it('CreateSession_ThrowsOn4xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('forbidden', { status: 403 })) as never;
    await expect(
      createSession({
        apiBase: '/api/v1',
        tenantId: 't1',
        visitorId: 'v1',
        profile: {},
        pageContext: { url: '', title: '', referrer: '' },
      }),
    ).rejects.toThrow();
  });

  it('FetchHistory_ReturnsArray_OnSuccess', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { id: 'm1', text: 'hi', from: 'agent', timestamp: '2026-05-09T10:00:00Z' },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    ) as never;
    const result = await fetchHistory({ apiBase: '/api/v1', sessionId: 's1' });
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('hi');
  });

  it('FetchHistory_Returns404_AsEmpty', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not found', { status: 404 })) as never;
    const result = await fetchHistory({ apiBase: '/api/v1', sessionId: 's1' });
    expect(result).toEqual([]);
  });
});
