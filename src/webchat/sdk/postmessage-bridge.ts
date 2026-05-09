type Direction = 'host' | 'iframe';
type Handler = (payload?: unknown) => void;

export interface BridgeConfig {
  /** Returns the target window to post to. May return null if iframe not loaded yet. */
  target: () => Window | null;
  /** The origin the receiver iframe is served from. Always validated, never '*'. */
  targetOrigin: string;
  /** The origin we accept messages from. */
  expectedSourceOrigin: string;
  /** 'host' (default) or 'iframe'. Determines source tag for outbound, expected tag for inbound. */
  side?: Direction;
}

export interface BridgeHandle {
  send(type: string, payload?: unknown): void;
  on(type: string, handler: Handler): void;
  off(type: string, handler: Handler): void;
  destroy(): void;
}

interface Envelope {
  source: 'verbara-webchat-host' | 'verbara-webchat-iframe';
  type: string;
  payload?: unknown;
}

export function createPostMessageBridge(config: BridgeConfig): BridgeHandle {
  const side: Direction = config.side ?? 'host';
  const ourSource: Envelope['source'] =
    side === 'host' ? 'verbara-webchat-host' : 'verbara-webchat-iframe';
  const expectedSource: Envelope['source'] =
    side === 'host' ? 'verbara-webchat-iframe' : 'verbara-webchat-host';

  const handlers = new Map<string, Set<Handler>>();
  const queue: Array<{ type: string; payload?: unknown }> = [];

  function flushQueue() {
    const target = config.target();
    if (!target) return;
    while (queue.length > 0) {
      const msg = queue.shift()!;
      target.postMessage(
        { source: ourSource, type: msg.type, payload: msg.payload } satisfies Envelope,
        config.targetOrigin,
      );
    }
  }

  function send(type: string, payload?: unknown) {
    const target = config.target();
    if (!target) {
      queue.push({ type, payload });
      return;
    }
    target.postMessage(
      { source: ourSource, type, payload } satisfies Envelope,
      config.targetOrigin,
    );
  }

  function listener(e: MessageEvent) {
    if (e.origin !== config.expectedSourceOrigin) return;
    const data = e.data as Envelope | undefined;
    if (!data || data.source !== expectedSource) return;
    const set = handlers.get(data.type);
    if (set) for (const h of set) h(data.payload);
  }
  globalThis.addEventListener('message', listener);

  // Periodically try to flush queue (in case target window appears later)
  const interval = globalThis.setInterval(flushQueue, 100);

  return {
    send,
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
    },
    off(type, handler) {
      handlers.get(type)?.delete(handler);
    },
    destroy() {
      globalThis.removeEventListener('message', listener);
      globalThis.clearInterval(interval);
      handlers.clear();
    },
  };
}
