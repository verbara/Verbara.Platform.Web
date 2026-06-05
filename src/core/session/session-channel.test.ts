import { SessionChannel, type SessionMessage } from './session-channel';

describe('SessionChannel', () => {
  it('should_DeliverMessageToOtherInstance_WhenPosted', async () => {
    // The Vitest env (Node 24 / jsdom) exposes a real BroadcastChannel that
    // delivers cross-instance messages asynchronously, so we await delivery.
    const sender = new SessionChannel('verbara-session-test');
    const receiver = new SessionChannel('verbara-session-test');

    try {
      const received = await new Promise<SessionMessage | 'timeout'>((resolve) => {
        receiver.onMessage((msg) => resolve(msg));
        sender.post('logout');
        setTimeout(() => resolve('timeout'), 500);
      });

      expect(received).toEqual({ type: 'logout' });
    } finally {
      sender.close();
      receiver.close();
    }
  });

  it('should_NotThrow_WhenBroadcastChannelUnavailable', () => {
    const original = globalThis.BroadcastChannel;
    // Simulate an environment without BroadcastChannel (older browsers / SSR).
    delete (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;

    try {
      expect(() => {
        const channel = new SessionChannel('verbara-session-test');
        channel.onMessage(() => {});
        channel.post('activity');
        channel.close();
      }).not.toThrow();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });
});
