import { describe, it, expect, beforeEach } from 'vitest';
import {
  HOST_ORIGIN_PARAM,
  buildEmbedUrl,
  findSdkScriptSrc,
  resolveEmbedOrigin,
} from './embed-origin';

const SDK = 'https://console.customer.com/webchat/v1/verbara-webchat.js';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('embed-origin', () => {
  it('ResolveEmbedOrigin_ShouldUseTheScriptsOwnOrigin_WhenNoApiBase', () => {
    expect(resolveEmbedOrigin({ scriptSrc: SDK, pageHref: 'https://shop.example.com/cart' })).toBe(
      'https://console.customer.com',
    );
  });

  it('ResolveEmbedOrigin_ShouldResolveARelativeApiBaseAgainstTheScript_NotThePage', () => {
    expect(
      resolveEmbedOrigin({
        scriptSrc: SDK,
        apiBase: '/api/v1',
        pageHref: 'https://shop.example.com/cart',
      }),
    ).toBe('https://console.customer.com');
  });

  it('ResolveEmbedOrigin_ShouldUseAnAbsoluteApiBasesOrigin_WhenGiven', () => {
    expect(
      resolveEmbedOrigin({
        scriptSrc: SDK,
        apiBase: 'https://chat.customer.com/api/v1',
        pageHref: 'https://shop.example.com/cart',
      }),
    ).toBe('https://chat.customer.com');
  });

  it('ResolveEmbedOrigin_ShouldFallBackToThePage_WhenTheScriptSrcIsUnknownOrInvalid', () => {
    expect(resolveEmbedOrigin({ scriptSrc: null, pageHref: 'https://shop.example.com/cart' })).toBe(
      'https://shop.example.com',
    );
    expect(
      resolveEmbedOrigin({ scriptSrc: 'http://[bad', pageHref: 'https://shop.example.com/x' }),
    ).toBe('https://shop.example.com');
  });

  it('BuildEmbedUrl_ShouldBeAbsoluteOnTheEmbedOrigin_AndCarryTheHostOrigin', () => {
    const url = new URL(
      buildEmbedUrl('https://console.customer.com', {
        tenantId: 't1',
        locale: 'es-419',
        hostOrigin: 'https://shop.example.com',
      }),
    );
    expect(url.origin).toBe('https://console.customer.com');
    expect(url.pathname).toBe('/webchat/embed/');
    expect(url.searchParams.get('tenantId')).toBe('t1');
    expect(url.searchParams.get('locale')).toBe('es-419');
    expect(url.searchParams.get(HOST_ORIGIN_PARAM)).toBe('https://shop.example.com');
  });

  it('BuildEmbedUrl_ShouldOmitTheLocale_WhenNotGiven', () => {
    const url = new URL(
      buildEmbedUrl('https://console.customer.com', {
        tenantId: 't1',
        hostOrigin: 'https://shop.example.com',
      }),
    );
    expect(url.searchParams.has('locale')).toBe(false);
  });

  it('FindSdkScriptSrc_ShouldPreferTheCurrentScript', () => {
    const current = document.createElement('script');
    current.src = SDK;
    expect(findSdkScriptSrc(document, current)).toBe(SDK);
  });

  it('FindSdkScriptSrc_ShouldFindTheSdkTag_WhenThereIsNoCurrentScript', () => {
    const other = document.createElement('script');
    other.src = 'https://shop.example.com/app.js';
    const sdk = document.createElement('script');
    sdk.src = SDK;
    document.body.append(other, sdk);
    expect(findSdkScriptSrc(document, null)).toBe(SDK);
  });

  it('FindSdkScriptSrc_ShouldReturnNull_WhenNoTagMatches', () => {
    const inline = document.createElement('script');
    expect(findSdkScriptSrc(document, inline)).toBeNull();
  });
});
