/**
 * Where the widget's frame lives when the SDK runs on someone else's site (#426).
 *
 * The SDK tag sits on the customer's site (the host page) but is served by the Verbara deployment that also serves
 * the widget's page, its API and its socket. That origin, the embed origin, is the one that served this script, not
 * the host page's: the frame is loaded from it, and every message to the frame targets it.
 */

/** Query parameter that tells the frame its host page's origin, for browsers without `location.ancestorOrigins`. */
export const HOST_ORIGIN_PARAM = 'hostOrigin';

const SDK_SCRIPT_SELECTOR = 'script[src*="/webchat/v1/verbara-webchat"]';

function originOf(url: string | null | undefined, base?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).origin;
  } catch {
    return null;
  }
}

/**
 * The URL this SDK was loaded from: the running script while it executes, else the SDK tag on the page.
 * `document.currentScript` is set only during the script's first run, so the caller reads it then.
 */
export function findSdkScriptSrc(doc: Document, current: HTMLScriptElement | null): string | null {
  if (current?.src) return current.src;
  return doc.querySelector<HTMLScriptElement>(SDK_SCRIPT_SELECTOR)?.src || null;
}

/**
 * The embed origin: the origin of an explicit `apiBase` (a relative one resolves against the script, never the host
 * page), else the script's own origin, else the page's (the SDK served from the same site).
 */
export function resolveEmbedOrigin(input: {
  scriptSrc: string | null | undefined;
  apiBase?: string;
  pageHref: string;
}): string {
  const base = originOf(input.scriptSrc) ?? new URL(input.pageHref).origin;
  return originOf(input.apiBase, `${base}/`) ?? base;
}

/** The frame's absolute URL on the embed origin, carrying the host page's origin for the frame to pin. */
export function buildEmbedUrl(
  embedOrigin: string,
  params: { tenantId: string; locale?: string; hostOrigin: string },
): string {
  const url = new URL('/webchat/embed/', embedOrigin);
  url.searchParams.set('tenantId', params.tenantId);
  if (params.locale) url.searchParams.set('locale', params.locale);
  url.searchParams.set(HOST_ORIGIN_PARAM, params.hostOrigin);
  return url.toString();
}
