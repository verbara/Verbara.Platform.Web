import { useAuthStore } from '@/core/auth/auth-store';
import { refreshAccessToken } from '@/core/api/client';

/**
 * Silent session restore after a page load.
 *
 * Credentials are not persisted (see `auth-store`), so a reloaded tab rehydrates with a `user` but
 * no access token. Rather than treating that as signed out, we exchange the httpOnly refresh cookie
 * (ADR-0009 W1) for a fresh token before deciding.
 *
 * Memoised in a module variable so the several `AuthGuard` boundaries a route tree may mount share
 * one attempt: concurrent callers await the same in-flight promise, and callers arriving after it
 * settles get the cached verdict rather than firing a second refresh. The memo intentionally lives
 * for the whole page load — a failed restore means "this page load has no session", and retrying it
 * per mount would hammer the endpoint on every re-render of a redirecting guard.
 */
let _restorePromise: Promise<boolean> | null = null;

export function restoreSession(): Promise<boolean> {
  if (_restorePromise) return _restorePromise;

  _restorePromise = (async () => {
    const store = useAuthStore.getState();

    // Nothing to restore: a fresh browser must never pay a round-trip.
    if (!store.hasSession()) return false;

    // Already holding a usable token (in-app navigation, or another tab refreshed first).
    if (store.accessToken && !store.isTokenExpired()) return true;

    // Delegate rather than reimplement: `refreshAccessToken` owns the per-tab promise dedupe and the
    // cross-tab Web Locks serialisation, and broadcasts to sibling tabs on success.
    return refreshAccessToken();
  })();

  return _restorePromise;
}

/**
 * Drops the memoised verdict, so the next call judges the session afresh. Used by tests to isolate
 * cases; in the app it is driven by the subscription below.
 */
export function resetSessionRestore(): void {
  _restorePromise = null;
}

/**
 * A sign-in or sign-out inside the same page load invalidates a cached verdict — without this, a
 * user who lands on `/login` (restore resolved `false`), signs in, and navigates to a guarded route
 * would be judged by the PREVIOUS session's outcome and bounced straight back to `/login`.
 */
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) resetSessionRestore();
});
