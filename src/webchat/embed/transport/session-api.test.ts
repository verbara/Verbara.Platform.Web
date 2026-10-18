import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, CreateSessionError, isChatUnavailable } from './session-api';

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
  it('CreateSession_ThrowsWithStatusAndRetryAfter_WhenRateLimited', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('{}', { status: 429, headers: { 'Retry-After': '42' } }),
    ) as never;
    const error = await createSession({
      apiBase: '/api/v1',
      tenantId: 't1',
      visitorId: 'v1',
      profile: {},
      pageContext: { url: '', title: '', referrer: '' },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CreateSessionError);
    expect(error).toMatchObject({ status: 429, retryAfterMs: 42_000 });
    expect(isChatUnavailable(error)).toBe(false);
  });

  it('CreateSession_ThrowsChatUnavailable_WhenTenantHasNoActiveWebChat', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 404 })) as never;
    const error = await createSession({
      apiBase: '/api/v1',
      tenantId: 't1',
      visitorId: 'v1',
      profile: {},
      pageContext: { url: '', title: '', referrer: '' },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CreateSessionError);
    expect(error).toMatchObject({ status: 404 });
    expect(isChatUnavailable(error)).toBe(true);
  });

  it('IsChatUnavailable_ShouldBeFalse_WhenFailureIsNotASessionRefusal', () => {
    expect(isChatUnavailable(new TypeError('Failed to fetch'))).toBe(false);
    expect(isChatUnavailable(new CreateSessionError(503, undefined))).toBe(false);
  });
});
