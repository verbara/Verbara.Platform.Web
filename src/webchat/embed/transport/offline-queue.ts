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

const STORAGE_KEY = (tenantId: string) => `verbara-webchat-queue:${tenantId}`;

export function createOfflineQueue(tenantId: string, opts: Options = {}): OfflineQueue {
  const maxItems = opts.maxItems ?? 100;

  function read(): QueuedMessage[] {
    const raw = localStorage.getItem(STORAGE_KEY(tenantId));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as QueuedMessage[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(items: QueuedMessage[]): void {
    localStorage.setItem(STORAGE_KEY(tenantId), JSON.stringify(items));
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
      localStorage.removeItem(STORAGE_KEY(tenantId));
      return items;
    },
    size() {
      return read().length;
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY(tenantId));
    },
  };
}
