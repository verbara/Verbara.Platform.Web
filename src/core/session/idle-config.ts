/**
 * Pure configuration + helpers for the session idle-timeout feature.
 *
 * No React, no side effects — safe to import anywhere (hooks, utilities, tests).
 * The per-tenant idle threshold arrives from the backend as
 * `sessionIdleTimeoutMinutes`; {@link resolveIdleMinutes} normalises it to a
 * sane positive value (default 30) and the `*Ms` helpers convert to timers.
 */

/** How long before the hard idle deadline the warning modal appears (ms). */
export const WARNING_BEFORE_MS = 60_000;

/** Countdown duration shown in the warning modal (seconds). */
export const COUNTDOWN_SECONDS = 60;

/** Minimum gap between activity pings broadcast across tabs (ms). */
export const ACTIVITY_THROTTLE_MS = 5_000;

/** Lead time before token expiry to proactively refresh (ms). */
export const REFRESH_LEAD_MS = 60_000;

/**
 * Normalise a (possibly absent/invalid) idle-timeout minute value to a positive
 * number, falling back to the 30-minute default for `null`, `undefined`, or any
 * non-positive value.
 */
export function resolveIdleMinutes(m: number | null | undefined): number {
  return typeof m === 'number' && m > 0 ? m : 30;
}

/** Idle threshold expressed in milliseconds. */
export const idleMs = (minutes: number): number => minutes * 60_000;

/** Timestamp offset (ms) at which the warning should fire, relative to last activity. */
export const warningAtMs = (minutes: number): number => idleMs(minutes) - WARNING_BEFORE_MS;
