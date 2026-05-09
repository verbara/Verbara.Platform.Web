export interface WsMessage {
  type: string;
  body?: unknown;
  [key: string]: unknown;
}

export interface WsClientConfig {
  url: string;
  onOpen: () => void;
  onMessage: (msg: WsMessage) => void;
  onClose: (reason: string) => void;
  maxBackoffMs?: number;
}

export interface WsClient {
  connect(): void;
  disconnect(): void;
  send(msg: WsMessage): boolean;
  isConnected(): boolean;
}

export function createWsClient(config: WsClientConfig): WsClient {
  let ws: WebSocket | null = null;
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let manualDisconnect = false;
  const maxBackoff = config.maxBackoffMs ?? 30_000;

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (manualDisconnect) return;
    clearReconnect();
    const delay = Math.min(1000 * 2 ** attempts, maxBackoff);
    attempts++;
    reconnectTimer = setTimeout(() => {
      doConnect();
    }, delay);
  }

  function doConnect() {
    ws = new WebSocket(config.url);
    ws.onopen = () => {
      attempts = 0;
      config.onOpen();
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(String(e.data)) as WsMessage;
        config.onMessage(data);
      } catch {
        // Ignore non-JSON frames
      }
    };
    ws.onclose = (e) => {
      const reason = e.reason || 'closed';
      config.onClose(reason);
      ws = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      // Errors precede close; let onclose handle reconnect
    };
  }

  return {
    connect() {
      manualDisconnect = false;
      doConnect();
    },
    disconnect() {
      manualDisconnect = true;
      clearReconnect();
      ws?.close();
      ws = null;
    },
    send(msg) {
      if (!ws || ws.readyState !== 1) return false;
      ws.send(JSON.stringify(msg));
      return true;
    },
    isConnected() {
      return ws?.readyState === 1;
    },
  };
}
