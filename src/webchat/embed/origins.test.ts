import { describe, it, expect, vi, afterEach } from 'vitest';
import { embedApiBase, embedWsUrl, postToHost, resolveHostOrigin } from './origins';

const EMBED = 'https://console.customer.com';

function loc(search: string, ancestors?: string[]) {
  return {
    origin: EMBED,
    search,
    ...(ancestors
      ? {
          ancestorOrigins: Object.assign([...ancestors], {
            item: (i: number) => ancestors[i] ?? null,
            contains: (s: string) => ancestors.includes(s),
          }) as unknown as DOMStringList,
        }
      : {}),
  };
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('resolveHostOrigin', () => {
  it('ResolveHostOrigin_ShouldUseAncestorOrigins_WhenTheBrowserHasIt', () => {
    expect(
      resolveHostOrigin(
        loc('?hostOrigin=https%3A%2F%2Fevil.example', ['https://shop.example.com']),
      ),
    ).toBe('https://shop.example.com');
  });

  it('ResolveHostOrigin_ShouldUseTheQueryParam_WhenAncestorOriginsIsMissingOrEmpty', () => {
    expect(resolveHostOrigin(loc('?tenantId=t1&hostOrigin=https%3A%2F%2Fshop.example.com'))).toBe(
      'https://shop.example.com',
    );
    expect(resolveHostOrigin(loc('?hostOrigin=https%3A%2F%2Fshop.example.com', []))).toBe(
      'https://shop.example.com',
    );
  });

  it('ResolveHostOrigin_ShouldFallBackToItsOwnOrigin_WhenNothingUsableIsGiven', () => {
    expect(resolveHostOrigin(loc(''))).toBe(EMBED);
    expect(resolveHostOrigin(loc('?hostOrigin=not-a-url'))).toBe(EMBED);
    expect(resolveHostOrigin(loc('?hostOrigin=https%3A%2F%2Fshop.example.com%2Fpath'))).toBe(EMBED);
    expect(resolveHostOrigin(loc('?hostOrigin=javascript%3Aalert(1)'))).toBe(EMBED);
    expect(resolveHostOrigin(loc('', ['null']))).toBe(EMBED);
  });
});

describe('embedApiBase', () => {
  it('EmbedApiBase_ShouldDefaultToTheApiOnTheEmbedOrigin', () => {
    expect(embedApiBase(undefined, EMBED)).toBe(`${EMBED}/api/v1`);
  });

  it('EmbedApiBase_ShouldKeepASameOriginPath', () => {
    expect(embedApiBase('/api/v1', EMBED)).toBe(`${EMBED}/api/v1`);
    expect(embedApiBase(`${EMBED}/api/v1/`, EMBED)).toBe(`${EMBED}/api/v1`);
  });

  it('EmbedApiBase_ShouldIgnoreAnotherOrigin_AndUseTheEmbedOrigin', () => {
    expect(embedApiBase('https://shop.example.com/api/v1', EMBED)).toBe(`${EMBED}/api/v1`);
    expect(embedApiBase('http://[bad', EMBED)).toBe(`${EMBED}/api/v1`);
  });
});

describe('embedWsUrl', () => {
  it('EmbedWsUrl_ShouldPutARelativeSocketPathOnTheEmbedOrigin', () => {
    expect(embedWsUrl('/ws/webchat/s1', EMBED)).toBe('wss://console.customer.com/ws/webchat/s1');
    expect(embedWsUrl('/ws/webchat/s1', 'http://localhost:8080')).toBe(
      'ws://localhost:8080/ws/webchat/s1',
    );
  });

  it('EmbedWsUrl_ShouldKeepAnAbsoluteSocketUrlPlatformGave', () => {
    expect(embedWsUrl('wss://api.customer.com/ws/webchat/s1', EMBED)).toBe(
      'wss://api.customer.com/ws/webchat/s1',
    );
  });
});

describe('postToHost', () => {
  it('PostToHost_ShouldTargetThePinnedHostOrigin', () => {
    window.history.replaceState(null, '', '/?hostOrigin=https%3A%2F%2Fshop.example.com');
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    postToHost('unread', 3);
    expect(post).toHaveBeenCalledWith(
      { source: 'verbara-webchat-iframe', type: 'unread', payload: 3 },
      'https://shop.example.com',
    );
  });
});
