/**
 * The two origins the widget's frame works with when it is embedded on a site of another domain (#426).
 *
 * - Its own origin (the embed origin) serves this page, the API and the socket. Requests and the socket always go
 *   there, whatever `apiBase` the host page passes.
 * - The host page's origin is the only one it talks to over postMessage: the target of every message it sends and
 *   the only sender it accepts. It comes from `location.ancestorOrigins` where the browser has it, else from the
 *   query parameter the SDK appends to the frame's URL. A site that frames the widget with someone else's origin in
 *   that parameter only cuts itself off: its messages are ignored and the frame's never reach it.
 */
import { HOST_ORIGIN_PARAM } from '@/webchat/sdk/embed-origin';

const DEFAULT_API_PATH = '/api/v1';

interface FrameLocation {
  readonly origin: string;
  readonly search: string;
  readonly ancestorOrigins?: DOMStringList;
}

/** `value` when it is exactly an http(s) origin (no path, no query), else null. */
function asOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin === value ? value : null;
  } catch {
    return null;
  }
}

/** The host page's origin, or the frame's own when it is not framed or the host is unknown (same-site embedding). */
export function resolveHostOrigin(loc: FrameLocation): string {
  const ancestors = loc.ancestorOrigins;
  if (ancestors && ancestors.length > 0) return asOrigin(ancestors[0]) ?? loc.origin;
  return asOrigin(new URLSearchParams(loc.search).get(HOST_ORIGIN_PARAM)) ?? loc.origin;
}

/** The API base on the embed origin: the path of a same-origin `apiBase`, otherwise Platform's default path. */
export function embedApiBase(apiBase: string | undefined, origin: string): string {
  let path = DEFAULT_API_PATH;
  if (apiBase) {
    try {
      const url = new URL(apiBase, `${origin}/`);
      if (url.origin === origin) path = url.pathname;
    } catch {
      // keep the default path
    }
  }
  return `${origin}${path.replace(/\/$/, '')}`;
}

/** The socket URL: a path from Platform opens on the embed origin; an absolute URL Platform gave is kept. */
export function embedWsUrl(wsUrl: string, origin: string): string {
  return wsUrl.startsWith('ws') ? wsUrl : `${origin.replace(/^http/, 'ws')}${wsUrl}`;
}

/** Posts an event to the host page, addressed to its pinned origin only. */
export function postToHost(type: string, payload?: unknown): void {
  window.parent.postMessage(
    { source: 'verbara-webchat-iframe', type, payload },
    resolveHostOrigin(window.location),
  );
}
