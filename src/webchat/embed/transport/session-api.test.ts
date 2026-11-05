import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  identityTokenRefusalCodes,
  webchatSessionAnonymous,
  webchatSessionAnonymousSaturatedKey,
  webchatSessionAnonymousVerifiedKey,
  webchatSessionTokenRefused,
  webchatSessionUnverified,
  webchatSessionVerified,
} from '@/tests/utils/contract-doubles';
import {
  createSession,
  CreateSessionError,
  isChatUnavailable,
  type CreateSessionInput,
} from './session-api';

/** A value of the right form for a test: the fixture's token stays in the fixture. */
const A_TOKEN = 'aGVhZGVy.cGF5bG9hZA.c2lnbmF0dXJl';

const input: CreateSessionInput = {
  apiBase: '/api/v1',
  tenantId: 't-demo-0001',
  visitorId: '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b',
  profile: { name: 'Ana', email: 'ana@example.com' },
  pageContext: {
    url: 'https://shop.example.com/orders/123',
    title: 'Order 123',
    referrer: 'https://shop.example.com/',
  },
};

function answering(body: unknown) {
  const mock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  globalThis.fetch = mock as never;
  return mock;
}

function sentBody(mock: ReturnType<typeof answering>): Record<string, unknown> {
  const init = (mock.mock.calls[0] as unknown as [string, RequestInit])[1];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

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

  it('CreateSession_ShouldSendExactlyTheFixtureMembers_WhenTheSiteSuppliedAToken', async () => {
    const mock = answering(webchatSessionVerified);
    await createSession({ ...input, identityToken: A_TOKEN });
    expect(sentBody(mock)).toEqual({
      tenantId: 't-demo-0001',
      visitorId: '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b',
      visitorName: 'Ana',
      visitorEmail: 'ana@example.com',
      pageContext: {
        url: 'https://shop.example.com/orders/123',
        title: 'Order 123',
        referrer: 'https://shop.example.com/',
      },
      identityToken: A_TOKEN,
    });
  });

  it.each([
    ['omitted', {}],
    ['null', { identityToken: null }],
    ['empty', { identityToken: '' }],
    ['blank', { identityToken: '   ' }],
  ])('CreateSession_ShouldOmitIdentityToken_WhenTheTokenIs%s', async (_name, token) => {
    const mock = answering(webchatSessionUnverified);
    await createSession({ ...input, ...token });
    expect(sentBody(mock)).not.toHaveProperty('identityToken');
    expect(sentBody(mock)).toHaveProperty('visitorId', input.visitorId);
  });

  it('CreateSession_ShouldSendTheTokenUnchanged_WhenItIsNotBlank', async () => {
    const mock = answering(webchatSessionUnverified);
    await createSession({ ...input, identityToken: ' not.a.token ' });
    expect(sentBody(mock).identityToken).toBe(' not.a.token ');
  });

  it.each([
    ['level 2', webchatSessionVerified, 'Verified'],
    ['level 1', webchatSessionUnverified, 'Unverified'],
    ['anonymous', webchatSessionAnonymous, 'Anonymous'],
    ['a saturated key', webchatSessionAnonymousSaturatedKey, 'Anonymous'],
    ['a verified key', webchatSessionAnonymousVerifiedKey, 'Anonymous'],
  ])(
    'CreateSession_ShouldReadTheLevelAndNoRefusal_WhenTheAnswerIs %s',
    async (_name, body, level) => {
      answering(body);
      const result = await createSession(input);
      expect(result.sessionId).toBe(body.sessionId);
      expect(result.wsUrl).toBe(body.wsUrl);
      expect(result.identityLevel).toBe(level);
      expect(result).not.toHaveProperty('identityTokenRefusal');
    },
  );

  it('CreateSession_ShouldReadTheRefusal_AndKeepTheSession_WhenTheTokenWasRefused', async () => {
    answering(webchatSessionTokenRefused);
    const result = await createSession({ ...input, identityToken: A_TOKEN });
    expect(result.sessionId).toBe(webchatSessionTokenRefused.sessionId);
    expect(result.wsUrl).toBe(webchatSessionTokenRefused.wsUrl);
    expect(result.identityLevel).toBe('Unverified');
    expect(result.identityTokenRefusal).toBe('identity-token-expired');
  });

  it.each(identityTokenRefusalCodes)(
    'CreateSession_ShouldReadTheCodeVerbatim_WhenItIs %s',
    async (code) => {
      answering({ ...webchatSessionTokenRefused, identityTokenRefusal: code });
      const result = await createSession({ ...input, identityToken: A_TOKEN });
      expect(result.identityTokenRefusal).toBe(code);
    },
  );
});
