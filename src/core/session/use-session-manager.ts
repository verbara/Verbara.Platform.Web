/**
 * Activity-aware idle / session manager hook.
 *
 * Mounted once (in the app shell) it watches for user activity — DOM input,
 * live voice calls, and active conversations — and drives the idle-timeout
 * lifecycle:
 *
 *  1. Arms an idle timer relative to the last activity. When the *warning*
 *     threshold (`warningAtMs`) is crossed it either re-arms (if the agent is
 *     still meaningfully busy — a live call, an active conversation, or an
 *     external suppression predicate) or opens the warning modal and starts a
 *     1-second countdown. When the countdown hits zero the session is torn down
 *     via `onLogout` and the logout is broadcast to sibling tabs.
 *  2. Proactively refreshes the access token a fixed lead time before it
 *     expires (`tokenExpiry - REFRESH_LEAD_MS`), on an independent timer that is
 *     suspended while the warning is open.
 *  3. Coordinates across tabs over a {@link SessionChannel}: activity in one tab
 *     keeps the others alive, a logout in one logs the others out (locally,
 *     without re-broadcasting — so no logout storm), and a refresh reschedules
 *     everyone's proactive refresh.
 *
 * Design constraints:
 *  - The ONLY React state is `{ warningOpen, secondsLeft }`. Every timer lives
 *    in a ref so re-renders never reset or duplicate them.
 *  - Cross-tab logout never loops: the hook posts `'logout'` exactly once on a
 *    *local* expiry; an *inbound* `'logout'` calls `onRemoteLogout` (a local
 *    auth-clear + redirect) and never re-posts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_THROTTLE_MS,
  COUNTDOWN_SECONDS,
  REFRESH_LEAD_MS,
  resolveIdleMinutes,
  warningAtMs,
} from './idle-config';
import { SessionChannel } from './session-channel';
import { useAuthStore } from '@/core/auth/auth-store';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import { useConversationStore } from '@/agent/stores/conversation-store';

/** DOM events that count as user activity. All registered `{ passive: true }`. */
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const;

/** Conversation states that mean the agent is actively handling work. */
const ACTIVE_CONVERSATION_STATES = new Set(['active', 'on_hold', 'consulting']);

export interface SessionManagerOptions {
  /**
   * Local idle expiry: tear down the session (auth logout + redirect). The hook
   * broadcasts `'logout'` to sibling tabs itself, so this callback MUST NOT
   * re-broadcast (doing so would loop back through every tab's `onRemoteLogout`).
   */
  onLogout: () => void;
  /**
   * Received `'logout'` from another tab: clear local auth + redirect. MUST NOT
   * re-broadcast — the originating tab already told everyone.
   */
  onRemoteLogout: () => void;
  /** Proactively refresh the token (wired to `refreshAccessToken` by the caller). */
  onRefresh: () => void | Promise<unknown>;
  /** Cross-tab bus. Defaults to a fresh {@link SessionChannel} owned (and closed) by the hook. */
  channel?: SessionChannel;
  /** Override the resolved idle minutes (tests). */
  idleMinutesOverride?: number;
  /** When it returns true the warning is suppressed (e.g. deliberate aux state). Defaults to `false`. */
  shouldSuppressWarning?: () => boolean;
}

export interface SessionManagerResult {
  /** Whether the idle-warning modal should be shown. */
  warningOpen: boolean;
  /** Seconds remaining on the warning countdown (only meaningful while `warningOpen`). */
  secondsLeft: number;
  /** Dismiss the warning, re-arm the idle clock, broadcast activity, and refresh the token. */
  stayConnected: () => void;
}

/** True when a voice call is ringing or connected. */
function isVoiceCallActive(): boolean {
  const phase = useVoiceCallStore.getState().phase;
  return phase === 'ringing' || phase === 'active';
}

/** True when any conversation is in an actively-handled state. */
function isConversationActive(): boolean {
  const conversations = useConversationStore.getState().conversations;
  for (const conv of Object.values(conversations)) {
    if (ACTIVE_CONVERSATION_STATES.has(conv.state)) return true;
  }
  return false;
}

export function useSessionManager(opts: SessionManagerOptions): SessionManagerResult {
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  // Latest options in a ref so the always-current callbacks are reachable from
  // timers/listeners installed once, without re-installing them every render.
  // Updated in an effect (never during render) so the React Compiler can reason
  // about the component — every reader is a timer/listener that fires post-commit.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  // Timers / bookkeeping — never trigger a re-render.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityBroadcastAtRef = useRef(0);
  const lastDomActivityRef = useRef(0);
  const loggedOutRef = useRef(false);
  const warningOpenRef = useRef(false);
  useEffect(() => {
    warningOpenRef.current = warningOpen;
  }, [warningOpen]);
  const scheduleRefreshRef = useRef<() => void>(() => {});
  // The expiry we last fired a proactive refresh for. Guards against a tight
  // reschedule loop: after firing we only re-arm once `tokenExpiry` advances
  // (which `onRefresh` does in production); a stale/past expiry is skipped.
  const refreshedExpiryRef = useRef<number | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Stable handles to the imperative actions, declared up front so the effects
  // below can depend on them. They read fresh values from refs/stores.
  const channelRef = useRef<SessionChannel | null>(null);

  const resolveMinutes = useCallback((): number => {
    const override = optsRef.current.idleMinutesOverride;
    if (override !== undefined) return override;
    return resolveIdleMinutes(useAuthStore.getState().sessionIdleTimeoutMinutes);
  }, []);

  /**
   * Local idle expiry path. Idempotent (guarded by `loggedOutRef`): clears every
   * timer, broadcasts `'logout'` to sibling tabs exactly once, and invokes the
   * caller's teardown. The HOOK owns the broadcast so `onLogout` stays loop-free.
   */
  const doLocalLogout = useCallback(() => {
    if (loggedOutRef.current) return;
    loggedOutRef.current = true;
    clearIdleTimer();
    clearCountdown();
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setWarningOpen(false);
    channelRef.current?.post('logout');
    optsRef.current.onLogout();
  }, [clearIdleTimer, clearCountdown]);

  const openWarning = useCallback(() => {
    setWarningOpen(true);
    setSecondsLeft(COUNTDOWN_SECONDS);
    clearCountdown();
    countdownTimerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          doLocalLogout();
          return 0;
        }
        return next;
      });
    }, 1_000);
  }, [clearCountdown, doLocalLogout]);

  // `armIdleTimer` and `markActivity` are mutually recursive (the timer fires →
  // may re-arm). Hold `armIdleTimer` in a ref to break the cycle cleanly.
  const armIdleTimerRef = useRef<() => void>(() => {});

  const markActivity = useCallback(
    (broadcast = true) => {
      if (loggedOutRef.current) return;
      if (warningOpenRef.current) {
        clearCountdown();
        setWarningOpen(false);
      }
      armIdleTimerRef.current();
      if (broadcast) {
        const now = Date.now();
        if (now - activityBroadcastAtRef.current >= ACTIVITY_THROTTLE_MS) {
          activityBroadcastAtRef.current = now;
          channelRef.current?.post('activity');
        }
      }
    },
    [clearCountdown],
  );

  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    const minutes = resolveMinutes();
    idleTimerRef.current = setTimeout(() => {
      // The warning threshold fired. If the agent is still busy (external
      // suppression, a live call, or an active conversation) treat it as
      // activity and re-arm rather than nagging them.
      const suppressed =
        (optsRef.current.shouldSuppressWarning?.() ?? false) ||
        isVoiceCallActive() ||
        isConversationActive();
      if (suppressed) {
        markActivity(false);
        return;
      }
      openWarning();
    }, warningAtMs(minutes));
  }, [clearIdleTimer, resolveMinutes, markActivity, openWarning]);

  useEffect(() => {
    armIdleTimerRef.current = armIdleTimer;
  }, [armIdleTimer]);

  const stayConnected = useCallback(() => {
    clearCountdown();
    setWarningOpen(false);
    markActivity(true);
    void optsRef.current.onRefresh();
  }, [clearCountdown, markActivity]);

  // --- Channel ownership + inbound message handling -----------------------
  useEffect(() => {
    const owned = opts.channel === undefined;
    const channel = opts.channel ?? new SessionChannel();
    channelRef.current = channel;

    channel.onMessage((msg) => {
      if (msg.type === 'activity') {
        // Another tab saw activity — keep this tab alive, but DON'T re-broadcast.
        markActivity(false);
      } else if (msg.type === 'logout') {
        optsRef.current.onRemoteLogout();
      } else if (msg.type === 'refreshed') {
        scheduleRefreshRef.current();
      }
    });

    return () => {
      if (owned) channel.close();
      channelRef.current = null;
    };
  }, [opts.channel, markActivity]);

  // --- Idle timer + activity sources --------------------------------------
  useEffect(() => {
    loggedOutRef.current = false;
    armIdleTimer();

    const onActivity = () => {
      const now = Date.now();
      if (now - lastDomActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastDomActivityRef.current = now;
      markActivity(true);
    };

    for (const evt of ACTIVITY_EVENTS) {
      globalThis.addEventListener(evt, onActivity, { passive: true });
    }

    const unsubVoice = useVoiceCallStore.subscribe((state, prev) => {
      const becameActive =
        (state.phase === 'ringing' || state.phase === 'active') &&
        !(prev.phase === 'ringing' || prev.phase === 'active');
      if (becameActive) markActivity(true);
    });

    const unsubConv = useConversationStore.subscribe((state, prev) => {
      const nowActive = Object.values(state.conversations).some((c) =>
        ACTIVE_CONVERSATION_STATES.has(c.state),
      );
      const wasActive = Object.values(prev.conversations).some((c) =>
        ACTIVE_CONVERSATION_STATES.has(c.state),
      );
      if (nowActive && !wasActive) markActivity(true);
    });

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        globalThis.removeEventListener(evt, onActivity);
      }
      unsubVoice();
      unsubConv();
      clearIdleTimer();
      clearCountdown();
    };
    // armIdleTimer/markActivity are stable for the hook's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Proactive token refresh (independent timer) ------------------------
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (loggedOutRef.current) return;
    // Don't run a background refresh while the user is being asked to confirm
    // they're still here — `stayConnected` handles that path.
    if (warningOpenRef.current) return;

    const { accessToken, tokenExpiry } = useAuthStore.getState();
    if (!accessToken || tokenExpiry === null) return;
    // Already fired for this exact expiry — wait for it to advance (the auth
    // subscription reschedules once `onRefresh` pushes a new expiry). Prevents a
    // 0ms reschedule loop when the expiry is in the past.
    if (refreshedExpiryRef.current === tokenExpiry) return;

    const safeDelay = Math.max(tokenExpiry - REFRESH_LEAD_MS - Date.now(), 0);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      if (loggedOutRef.current) return;
      refreshedExpiryRef.current = tokenExpiry;
      void optsRef.current.onRefresh();
      // Reschedule against whatever the (possibly updated) expiry is now; the
      // guard above no-ops if it hasn't moved.
      scheduleRefreshRef.current();
    }, safeDelay);
  }, []);

  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh;
  }, [scheduleRefresh]);

  useEffect(() => {
    scheduleRefresh();

    // Reschedule whenever the token or its expiry changes.
    const unsubAuth = useAuthStore.subscribe((state, prev) => {
      if (state.accessToken !== prev.accessToken || state.tokenExpiry !== prev.tokenExpiry) {
        scheduleRefresh();
      }
    });

    return () => {
      unsubAuth();
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
    // scheduleRefresh is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the refresh timer in sync with the warning's open/closed state: pause
  // it while the warning shows, resume (reschedule) when it closes.
  useEffect(() => {
    scheduleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warningOpen]);

  return { warningOpen, secondsLeft, stayConnected };
}
