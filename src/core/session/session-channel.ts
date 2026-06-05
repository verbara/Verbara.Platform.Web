/**
 * Thin cross-tab message bus over the `BroadcastChannel` API.
 *
 * Used by the session idle-timeout feature to keep multiple tabs of the same
 * app in sync: a tab that sees activity, logs out, or refreshes its token tells
 * the others so they don't independently expire or duplicate work.
 *
 * Environments without `BroadcastChannel` (older browsers, some test runners)
 * are tolerated: the channel becomes a no-op rather than throwing, so callers
 * never need to feature-detect.
 */

/** Cross-tab session events. */
export interface SessionMessage {
  type: 'activity' | 'logout' | 'refreshed';
}

const CHANNEL_NAME = 'verbara-session';

export class SessionChannel {
  private readonly channel: BroadcastChannel | null;

  constructor(channelName: string = CHANNEL_NAME) {
    this.channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName);
  }

  /** Broadcast a message of the given type to every other open tab. No-op when unsupported. */
  post(type: SessionMessage['type']): void {
    this.channel?.postMessage({ type } satisfies SessionMessage);
  }

  /**
   * Register a callback invoked for each message received from another tab.
   * No-op (callback never fires) when `BroadcastChannel` is unavailable.
   */
  onMessage(cb: (msg: SessionMessage) => void): void {
    if (!this.channel) return;
    this.channel.onmessage = (event: MessageEvent<SessionMessage>) => cb(event.data);
  }

  /** Release the underlying channel. Safe to call when unsupported. */
  close(): void {
    this.channel?.close();
  }
}
