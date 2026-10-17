/**
 * The visitor's WebChat session, kept in the widget's own localStorage so a reload, or the next page of the same
 * site, continues the conversation instead of starting a new one (#426).
 *
 * Platform keeps sessions in memory and forgets one after `WebChatOptions.SessionTimeout` (30 minutes) without
 * activity; attaching a socket and every visitor message count as activity. A socket to a session it still knows
 * re-attaches to it. The widget mirrors that rule with {@link SESSION_TIMEOUT_MS}: a stored session idle for longer
 * is not tried. The server stays the judge: a session it no longer knows is refused, and the widget then starts a
 * new one.
 *
 * The stored session belongs to the visitor id the host page gave the widget. The SDK's `destroy()` forgets that
 * id (`resetVisitor`), so the next visitor on that browser gets a new id and does not resume the old session.
 */

/** Platform's `WebChatOptions.SessionTimeout`. Change both together. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Socket attempts in a row that may end without opening before the widget gives the session up and starts a new
 * one. A browser cannot tell why a socket failed: Platform answers an unknown or forgotten session with a 404
 * before the upgrade, which the page sees only as a close with code 1006, the same as a network failure. With the
 * socket's backoff (1, 2, 4, 8 s) five attempts span about 15 seconds, so a short network drop keeps the
 * conversation.
 */
export const MAX_ATTACH_ATTEMPTS = 5;

export interface StoredSession {
  sessionId: string;
  /** Absolute `ws:`/`wss:` URL of the session's socket. */
  wsUrl: string;
  visitorId: string;
  /** Epoch ms when Platform created the session. */
  createdAt: number;
  /** Epoch ms of the last activity Platform saw from this widget (socket attached, message sent). */
  lastActiveAt: number;
}

const KEY = (tenantId: string) => `verbara-webchat-session:${tenantId}`;

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['sessionId'] === 'string' &&
    typeof v['wsUrl'] === 'string' &&
    typeof v['visitorId'] === 'string' &&
    typeof v['createdAt'] === 'number' &&
    typeof v['lastActiveAt'] === 'number'
  );
}

/** The stored session of this visitor, or null when there is none, it is someone else's, or it has gone idle. */
export function loadStoredSession(
  tenantId: string,
  visitorId: string,
  now: number = Date.now(),
): StoredSession | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY(tenantId));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isStoredSession(parsed)) return null;
  if (parsed.visitorId !== visitorId) return null;
  if (now - parsed.lastActiveAt >= SESSION_TIMEOUT_MS) return null;
  return parsed;
}

export function saveStoredSession(tenantId: string, session: StoredSession): void {
  try {
    localStorage.setItem(KEY(tenantId), JSON.stringify(session));
  } catch {
    // Storage unavailable: the session still works for this page load.
  }
}

/** Records activity on the stored session, when it is still `sessionId`. */
export function touchStoredSession(
  tenantId: string,
  sessionId: string,
  now: number = Date.now(),
): void {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY(tenantId));
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredSession(parsed) && parsed.sessionId === sessionId) {
      saveStoredSession(tenantId, { ...parsed, lastActiveAt: now });
    }
  } catch {
    // Unreadable entry: leave it; loadStoredSession ignores it.
  }
}

/** Forgets the stored session; with `sessionId`, only when it is still that one (another tab may have replaced it). */
export function clearStoredSession(tenantId: string, sessionId?: string): void {
  try {
    if (sessionId !== undefined) {
      const raw = localStorage.getItem(KEY(tenantId));
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isStoredSession(parsed) && parsed.sessionId !== sessionId) return;
    }
    localStorage.removeItem(KEY(tenantId));
  } catch {
    // Storage unavailable: nothing was stored.
  }
}
