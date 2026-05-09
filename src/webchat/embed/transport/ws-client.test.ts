import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWsClient } from './ws-client';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  url: string;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  sentMessages: string[] = [];
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(msg: string) {
    this.sentMessages.push(msg);
  }
  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as never;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ws-client', () => {
  it('Connect_OpensWebSocket_AndCallsOnOpen', () => {
    const onOpen = vi.fn();
    const client = createWsClient({
      url: 'wss://x/ws/y',
      onOpen,
      onMessage: vi.fn(),
      onClose: vi.fn(),
    });
    client.connect();
    FakeWebSocket.instances[0]?.simulateOpen();
    expect(onOpen).toHaveBeenCalled();
    client.disconnect();
  });

  it('Send_PostsJsonMessage_WhenConnected', () => {
    const client = createWsClient({
      url: 'wss://x',
      onOpen: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
    });
    client.connect();
    FakeWebSocket.instances[0]?.simulateOpen();
    client.send({ type: 'message', body: 'hi' });
    expect(FakeWebSocket.instances[0]?.sentMessages).toContain(
      JSON.stringify({ type: 'message', body: 'hi' }),
    );
    client.disconnect();
  });

  it('OnMessage_FiresWithParsedJson', () => {
    const onMessage = vi.fn();
    const client = createWsClient({ url: 'wss://x', onOpen: vi.fn(), onMessage, onClose: vi.fn() });
    client.connect();
    FakeWebSocket.instances[0]?.simulateOpen();
    FakeWebSocket.instances[0]?.simulateMessage(JSON.stringify({ type: 'message', body: 'hi' }));
    expect(onMessage).toHaveBeenCalledWith({ type: 'message', body: 'hi' });
    client.disconnect();
  });

  it('Reconnect_AttemptsAfterExponentialBackoff_OnClose', () => {
    const client = createWsClient({
      url: 'wss://x',
      onOpen: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
    });
    client.connect();
    FakeWebSocket.instances[0]?.simulateOpen();
    FakeWebSocket.instances[0]?.close();
    // First reconnect after 1000ms
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances.length).toBe(2);
    client.disconnect();
  });
});
