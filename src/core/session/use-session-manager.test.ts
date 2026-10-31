import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionManager, type SessionManagerOptions } from './use-session-manager';
import { COUNTDOWN_SECONDS, REFRESH_LEAD_MS, warningAtMs } from './idle-config';
import type { SessionMessage } from './session-channel';
import { useVoiceCallStore } from '@/core/stores/voice-call-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { registerActiveWorkSource, type ActiveWorkSource } from './active-work-registry';

/**
 * A controllable stand-in for {@link SessionChannel} that lets a test inspect
 * everything posted and synchronously deliver inbound messages. Implements the
 * same surface the hook consumes (`post`/`onMessage`/`close`); structurally
 * compatible so it can be passed via `opts.channel`.
 */
class FakeChannel {
  posted: SessionMessage['type'][] = [];
  closed = false;
  private cb: ((msg: SessionMessage) => void) | null = null;

  post(type: SessionMessage['type']): void {
    this.posted.push(type);
  }

  onMessage(cb: (msg: SessionMessage) => void): void {
    this.cb = cb;
  }

  close(): void {
    this.closed = true;
  }

  /** Test-only: deliver an inbound message as if from another tab. */
  deliver(type: SessionMessage['type']): void {
    this.cb?.({ type });
  }
}

/** An active-work source a test drives by hand, as a domain store would. */
function makeFakeSource() {
  let active = false;
  const listeners = new Set<() => void>();
  const source: ActiveWorkSource = {
    isActive: () => active,
    subscribe: (onBecameActive) => {
      listeners.add(onBecameActive);
      return () => listeners.delete(onBecameActive);
    },
  };
  return {
    source,
    setActive(next: boolean) {
      const became = next && !active;
      active = next;
      if (became) for (const listener of listeners) listener();
    },
  };
}

function setup(overrides: Partial<SessionManagerOptions> = {}) {
  const onLogout = vi.fn();
  const onRemoteLogout = vi.fn();
  const onRefresh = vi.fn();
  const channel = new FakeChannel();
  const opts: SessionManagerOptions = {
    onLogout,
    onRemoteLogout,
    onRefresh,
    channel: channel as unknown as SessionManagerOptions['channel'],
    idleMinutesOverride: 2,
    ...overrides,
  };
  const view = renderHook((p: SessionManagerOptions) => useSessionManager(p), {
    initialProps: opts,
  });
  return { ...view, onLogout, onRemoteLogout, onRefresh, channel };
}

const WARNING_AT = warningAtMs(2); // 2 minutes → 60_000 ms (idleMs 120_000 - WARNING_BEFORE_MS 60_000)

describe('useSessionManager', () => {
  let unregisterSources: (() => void)[] = [];

  function registerFakeSource() {
    const fake = makeFakeSource();
    unregisterSources.push(registerActiveWorkSource(fake.source));
    return fake;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    useVoiceCallStore.getState().reset();
    useAuthStore.setState({ accessToken: null, tokenExpiry: null });
  });

  afterEach(() => {
    for (const unregister of unregisterSources) unregister();
    unregisterSources = [];
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('OpensWarning_ShouldFireAtWarningAt_WhenIdle', () => {
    const { result } = setup();

    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1);
    });
    expect(result.current.warningOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.warningOpen).toBe(true);
    expect(result.current.secondsLeft).toBe(COUNTDOWN_SECONDS);
  });

  it('Activity_ShouldReArmClock_WhenKeydownBeforeWarning', () => {
    const { result } = setup();

    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1_000);
    });
    expect(result.current.warningOpen).toBe(false);

    act(() => {
      globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });

    // Advance past the OLD warning deadline — the clock should have re-armed.
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(result.current.warningOpen).toBe(false);

    // Crossing the NEW deadline opens it.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);
  });

  it('ActiveVoiceCall_ShouldSuppressWarning_WhenDeadlinePassed', () => {
    const { result, onLogout } = setup();

    act(() => {
      useVoiceCallStore.setState({ phase: 'active' });
    });

    act(() => {
      vi.advanceTimersByTime(WARNING_AT + 5_000);
    });
    expect(result.current.warningOpen).toBe(false);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('ActiveWork_ShouldCountAsActivity_WhenDeadlinePassed', () => {
    const fake = registerFakeSource();
    const { result, onLogout } = setup();

    act(() => {
      fake.setActive(true);
    });

    act(() => {
      vi.advanceTimersByTime(WARNING_AT + 5_000);
    });
    expect(result.current.warningOpen).toBe(false);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('ActiveWork_ShouldSuppressWarning_WhenSourceRegisteredAfterTheEffectRan', () => {
    const { result, onLogout } = setup();
    const fake = registerFakeSource();

    // Already active, so no transition reaches the session: only the deadline's read can see it.
    fake.setActive(true);

    act(() => {
      vi.advanceTimersByTime(WARNING_AT + 5_000);
    });
    expect(result.current.warningOpen).toBe(false);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('ActiveWork_ShouldRestartTheIdleCountdown_WhenSourceRegisteredAfterTheEffectRan', () => {
    const { result, channel } = setup();
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1_000);
    });
    const fake = registerFakeSource();

    act(() => {
      fake.setActive(true);
    });
    expect(channel.posted).toContain('activity');

    // The work ends, so only the restarted clock can keep the warning away past the old deadline.
    fake.setActive(false);
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(result.current.warningOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);
  });

  it('ActiveWork_ShouldCloseTheWarning_WhenLateSourceBecomesActiveDuringIt', () => {
    const { result } = setup();
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);
    const fake = registerFakeSource();

    act(() => {
      fake.setActive(true);
    });

    expect(result.current.warningOpen).toBe(false);
  });

  it('ActiveWork_ShouldStopReachingTheSession_WhenTheHookUnmounted', () => {
    const fake = registerFakeSource();
    const { unmount } = setup();

    unmount();
    fake.setActive(true);

    // A listener left behind would re-arm the idle timer of an unmounted hook.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SuppressWarning_ShouldNeverOpen_WhenPredicateTrue', () => {
    const { result, onLogout } = setup({ shouldSuppressWarning: () => true });

    act(() => {
      vi.advanceTimersByTime(WARNING_AT + COUNTDOWN_SECONDS * 1_000 + 5_000);
    });
    expect(result.current.warningOpen).toBe(false);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('Countdown_ShouldDecrementAndLogoutOnce_WhenReachesZero', () => {
    const { result, onLogout, channel } = setup();

    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);
    expect(result.current.secondsLeft).toBe(COUNTDOWN_SECONDS);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.secondsLeft).toBe(COUNTDOWN_SECONDS - 1);

    act(() => {
      vi.advanceTimersByTime((COUNTDOWN_SECONDS - 1) * 1_000);
    });
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(channel.posted).toContain('logout');

    // No further logout calls even if more time passes.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('StayConnected_ShouldCloseWarningReArmAndRefresh', () => {
    const { result, onRefresh, channel } = setup();

    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);

    act(() => {
      result.current.stayConnected();
    });
    expect(result.current.warningOpen).toBe(false);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(channel.posted).toContain('activity');

    // Re-armed: advancing past the warning deadline opens it again.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);
  });

  it('ActivityMessage_ShouldResetAndCloseWarning_WithoutReBroadcast', () => {
    const { result, channel } = setup();

    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);

    const before = channel.posted.length;
    act(() => {
      channel.deliver('activity');
    });
    expect(result.current.warningOpen).toBe(false);
    // No re-broadcast of activity in response to an inbound activity message.
    expect(channel.posted.length).toBe(before);
  });

  it('LogoutMessage_ShouldCallRemoteLogout_NotLocalLogout', () => {
    const { onLogout, onRemoteLogout, channel } = setup();

    act(() => {
      channel.deliver('logout');
    });
    expect(onRemoteLogout).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('ProactiveRefresh_ShouldFireNearExpiryLead_WhenTokenPresent', () => {
    // Suppress the idle warning so it never opens during the long advance and
    // pauses the (independent) refresh timer — this test isolates the refresh path.
    const { onRefresh } = setup({ shouldSuppressWarning: () => true });

    const expiry = Date.now() + 5 * 60_000; // 5 minutes out
    act(() => {
      useAuthStore.setState({ accessToken: 'tok', tokenExpiry: expiry });
    });

    // Just before the lead window — should not have fired.
    act(() => {
      vi.advanceTimersByTime(5 * 60_000 - REFRESH_LEAD_MS - 1_000);
    });
    expect(onRefresh).not.toHaveBeenCalled();

    // Cross the lead window (tokenExpiry - REFRESH_LEAD_MS).
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('Unmount_ShouldCloseOwnedChannel_ButNotInjectedOne', () => {
    // Injected channel: must NOT be closed by the hook.
    const injected = new FakeChannel();
    const view = renderHook(() =>
      useSessionManager({
        onLogout: vi.fn(),
        onRemoteLogout: vi.fn(),
        onRefresh: vi.fn(),
        channel: injected as unknown as SessionManagerOptions['channel'],
        idleMinutesOverride: 2,
      }),
    );
    view.unmount();
    expect(injected.closed).toBe(false);
  });

  it('SignOut_ShouldRunLocalLogoutPathOnce_WhenCalled', () => {
    const { result, onLogout, onRemoteLogout, channel } = setup();

    act(() => {
      result.current.signOut();
    });
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onRemoteLogout).not.toHaveBeenCalled();
    expect(channel.posted).toContain('logout');

    // Idempotent: a second call (or a later countdown) does not re-fire.
    act(() => {
      result.current.signOut();
    });
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('SuppressedAtWarningTime_ShouldKeepWatching_WhenSuppressionLifts', () => {
    // A voice call active at warning time suppresses; once it ends and the
    // re-armed deadline passes again with no activity, the warning opens.
    const { result } = setup();

    act(() => {
      useVoiceCallStore.setState({ phase: 'active' });
    });
    act(() => {
      vi.advanceTimersByTime(WARNING_AT + 1_000);
    });
    expect(result.current.warningOpen).toBe(false);

    // Call ends; the subscribe-driven activity does NOT fire on 'ended', so the
    // already re-armed timer keeps running. Set to idle (no further activity).
    act(() => {
      useVoiceCallStore.setState({ phase: 'ended' });
    });
    act(() => {
      vi.advanceTimersByTime(WARNING_AT + 1_000);
    });
    expect(result.current.warningOpen).toBe(true);
  });
});
