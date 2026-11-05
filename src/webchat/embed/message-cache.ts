import type { ChatMessage } from './transport/session-api';

/**
 * The last messages the widget showed a visitor, kept in this frame's storage so a reload or the next page shows
 * them again. The cache belongs to one visitor id: another visitor of the same tenant on this browser never reads it.
 */

const PREFIX = 'verbara-webchat-messages:';
/** The tenant-only key earlier versions wrote. It cannot be told apart by visitor, so it is never read. */
const TENANT_KEY = (tenantId: string) => `${PREFIX}${tenantId}`;
const KEY = (tenantId: string, visitorId: string) => `${TENANT_KEY(tenantId)}:${visitorId}`;
const MAX_CACHED = 100;

export function loadCachedMessages(tenantId: string, visitorId: string): ChatMessage[] {
  let raw: string | null;
  try {
    localStorage.removeItem(TENANT_KEY(tenantId));
    raw = localStorage.getItem(KEY(tenantId, visitorId));
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCachedMessages(
  tenantId: string,
  visitorId: string,
  messages: ChatMessage[],
): void {
  const trimmed = messages.slice(-MAX_CACHED);
  try {
    localStorage.setItem(KEY(tenantId, visitorId), JSON.stringify(trimmed));
  } catch {
    // Storage unavailable or full: the messages still show for this page load.
  }
}

/** Forgets the cached messages of one visitor. */
export function clearVisitorMessages(tenantId: string, visitorId: string): void {
  try {
    localStorage.removeItem(KEY(tenantId, visitorId));
  } catch {
    // Storage unavailable: nothing was stored.
  }
}

/** Forgets the cached messages of every visitor of the tenant, and the tenant-only entry of earlier versions. */
export function clearCachedMessages(tenantId: string): void {
  const exact = TENANT_KEY(tenantId);
  const visitorPrefix = `${exact}:`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && (key === exact || key.startsWith(visitorPrefix))) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was stored.
  }
}
