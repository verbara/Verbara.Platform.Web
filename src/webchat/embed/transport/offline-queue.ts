/**
 * What a visitor typed while the socket was not open, sent when it opens. The queue belongs to one visitor id:
 * another visitor of the same tenant on this browser never reads or sends it.
 */

export interface QueuedMessage {
  id: string;
  text: string;
  timestamp: string;
}

export interface OfflineQueue {
  push(msg: QueuedMessage): void;
  drain(): QueuedMessage[];
  size(): number;
  clear(): void;
}

interface Options {
  maxItems?: number;
}

const PREFIX = 'verbara-webchat-queue:';
/** The tenant-only key earlier versions wrote. It cannot be told apart by visitor, so it is never read. */
const TENANT_KEY = (tenantId: string) => `${PREFIX}${tenantId}`;
const VISITOR_PREFIX = (tenantId: string) => `${TENANT_KEY(tenantId)}:`;
const KEY = (tenantId: string, visitorId: string) => `${VISITOR_PREFIX(tenantId)}${visitorId}`;

export function createOfflineQueue(
  tenantId: string,
  visitorId: string,
  opts: Options = {},
): OfflineQueue {
  const maxItems = opts.maxItems ?? 100;
  const key = KEY(tenantId, visitorId);

  function read(): QueuedMessage[] {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as QueuedMessage[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(items: QueuedMessage[]): void {
    localStorage.setItem(key, JSON.stringify(items));
  }

  return {
    push(msg) {
      const items = read();
      items.push(msg);
      while (items.length > maxItems) items.shift();
      write(items);
    },
    drain() {
      const items = read();
      localStorage.removeItem(key);
      return items;
    },
    size() {
      return read().length;
    },
    clear() {
      localStorage.removeItem(key);
    },
  };
}

/** Removes the tenant's queues, and the tenant-only entry of earlier versions, that `keep` does not name. */
function removeTenantQueues(tenantId: string, keep?: string): void {
  const exact = TENANT_KEY(tenantId);
  // The trailing colon keeps tenant `t1` off tenant `t10`.
  const visitorPrefix = VISITOR_PREFIX(tenantId);
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key !== keep && (key === exact || key.startsWith(visitorPrefix))) {
        keys.push(key);
      }
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was queued.
  }
}

/**
 * Runs when the widget starts for a visitor, before it reads a queue or creates a session. Only this visitor's
 * queue stays: a forget whose frame never answered left the earlier visitor's behind, and it is erased here.
 */
export function settleVisitorQueues(tenantId: string, visitorId: string): void {
  removeTenantQueues(tenantId, KEY(tenantId, visitorId));
}

/** Forgets the queues of every visitor of the tenant, and the tenant-only entry of earlier versions. */
export function clearTenantQueues(tenantId: string): void {
  removeTenantQueues(tenantId);
}
