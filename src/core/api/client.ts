import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { SessionChannel } from '@/core/session/session-channel';
import {
  PaymentRequiredError,
  isPaymentRequiredProblemDetails,
  usePaymentRequiredStore,
} from '@/core/licensing';
import { ApiError } from './api-error';

interface RequestConfig {
  url: string;
  method: string;
  data?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * When `true`, a 402 Payment Required does NOT pop the global upgrade modal —
   * it still throws {@link PaymentRequiredError} so the caller can handle it
   * locally (e.g. license-gated affordances that should silently no-op for
   * unlicensed tenants, like the optional typification AI suggestion).
   */
  suppressPaymentRequiredModal?: boolean;
}

class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

let _refreshPromise: Promise<boolean> | null = null;
/** The in-flight {@link probeSession} of this tab, shared by concurrent callers. */
let _probePromise: Promise<SessionProbeResult> | null = null;

/**
 * Lazily-created cross-tab bus. Built on first successful refresh so SSR /
 * test environments without `window` (or `BroadcastChannel`) never construct
 * one eagerly. `SessionChannel` itself degrades to a no-op when the underlying
 * `BroadcastChannel` is unavailable.
 */
let _sessionChannel: SessionChannel | null = null;

function getSessionChannel(): SessionChannel | null {
  if (typeof window === 'undefined') return null;
  if (!_sessionChannel) {
    _sessionChannel = new SessionChannel();
  }
  return _sessionChannel;
}

/** The body of a successful `POST /api/v1/auth/refresh`. */
interface RefreshResponseBody {
  accessToken: string;
  expiresAt: string;
  permissions?: string[];
  sessionIdleTimeoutMinutes?: number;
}

function postRefresh(): Promise<Response> {
  return fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Applies a successful refresh: pushes the new token into the auth store and broadcasts
 * `'refreshed'` to other tabs so they reschedule their proactive-refresh timers. Shared by
 * {@link doRefresh} and {@link probeSession}, so both apply a token the same way.
 */
function applyRefreshedToken(data: RefreshResponseBody): void {
  const store = useAuthStore.getState();
  if (store.user && store.tenantId) {
    store.setAuth(
      data.accessToken,
      new Date(data.expiresAt).getTime(),
      store.user,
      store.tenantId,
      // An EMPTY array is treated as "the server did not tell us", not as "this user has no
      // permissions". `?? store.permissions` alone was dead code: /auth/refresh always serialises
      // `permissions?.ToArray() ?? []`, so an unresolvable RBAC lookup arrives as `[]` rather than
      // as an absent field — and every refresh wiped the permission set the UI routes on, sending
      // the user to /unauthorized. Server-side authorization is unaffected either way: the API
      // resolves permissions per request, so a stale client set can only show an affordance the
      // API then rejects. Belt to the real fix in the refresh endpoint, which must apply the same
      // role-default fallback the login path already does.
      data.permissions?.length ? data.permissions : store.permissions,
      store.features,
      data.sessionIdleTimeoutMinutes ?? store.sessionIdleTimeoutMinutes,
    );
  }

  // Tell other tabs a fresh token landed so they reschedule (and don't each
  // race to refresh). Only on success — a failed refresh broadcasts nothing.
  getSessionChannel()?.post('refreshed');
}

/**
 * Performs the actual network refresh: POST `/auth/refresh`, parse the new
 * token and apply it ({@link applyRefreshedToken}). Returns `true` when
 * the token is now valid, `false` on any failure. Never throws.
 *
 * This is the body extracted from the original `refreshAccessToken`; the
 * existing `sessionIdleTimeoutMinutes` handling is preserved verbatim.
 */
async function doRefresh(): Promise<boolean> {
  try {
    const res = await postRefresh();

    if (!res.ok) return false;

    const data = (await res.json()) as RefreshResponseBody;
    applyRefreshedToken(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Refreshes the access token, deduplicated per-tab via `_refreshPromise` and
 * serialized across tabs via the Web Locks API (`'verbara-refresh'`). When
 * `navigator.locks` is unavailable the per-tab dedupe still applies and we fall
 * straight through to {@link doRefresh}.
 *
 * Contract is unchanged for callers: resolves `true` when the token is now
 * valid (including the "another tab already refreshed" fast-path) and `false`
 * when the refresh failed (callers then log out). Exported so the session
 * manager can trigger proactive refreshes.
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      // Never overlap a session probe in this tab: without Web Locks the two POSTs would present
      // the same refresh cookie concurrently. (With Web Locks the lock already serializes them.)
      if (_probePromise) await _probePromise;
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return await navigator.locks.request('verbara-refresh', async () => {
          // Another tab may have refreshed while we waited for the lock.
          if (!useAuthStore.getState().isTokenExpired()) return true;
          return doRefresh();
        });
      }
      return await doRefresh();
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * What a session probe found out about the session (design D5):
 * - `active` — the server minted a new access token, so the session holds;
 * - `ended` — the server refused the refresh (401 or 403), so the session is gone;
 * - `unknown` — no verdict (network failure, 5xx, or any other answer). Never a reason to sign out.
 */
export type SessionProbeResult = 'active' | 'ended' | 'unknown';

async function doProbe(): Promise<SessionProbeResult> {
  let res: Response;
  try {
    res = await postRefresh();
  } catch {
    return 'unknown';
  }

  if (res.status === 401 || res.status === 403) return 'ended';
  if (!res.ok) return 'unknown';

  let data: RefreshResponseBody;
  try {
    data = (await res.json()) as RefreshResponseBody;
  } catch {
    return 'unknown';
  }

  // The refresh cookie belongs to the original sign-in — during an impersonation, the operator's.
  // Applying its token would install the operator's own token next to the target tenant while the
  // impersonation stays active, dropping its read-only guard and its attribution. So the probe only
  // reports the verdict and keeps the impersonation token.
  if (useAuthStore.getState().impersonation?.active) return 'active';

  applyRefreshedToken(data);
  return 'active';
}

/**
 * Asks the server whether the session still exists, by a REAL `POST /api/v1/auth/refresh`.
 *
 * Unlike {@link refreshAccessToken} it has no "held token is not expired" short-circuit: a
 * suspended account keeps a valid access token for up to its lifetime, and only the server knows
 * the refresh lineage was revoked. It runs under the same `verbara-refresh` Web Lock (so it never
 * overlaps another tab's refresh), never overlaps an in-flight refresh in this tab, and concurrent
 * probes in one tab share one request.
 *
 * On `active` the new token is applied exactly as {@link refreshAccessToken} applies one, except
 * while an impersonation is active (see {@link doProbe}). Never throws.
 */
export function probeSession(): Promise<SessionProbeResult> {
  if (_probePromise) return _probePromise;

  _probePromise = (async () => {
    try {
      if (_refreshPromise) await _refreshPromise;
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return await navigator.locks.request('verbara-refresh', () => doProbe());
      }
      return await doProbe();
    } catch {
      return 'unknown' as const;
    } finally {
      _probePromise = null;
    }
  })();

  return _probePromise;
}

/**
 * Result envelope returned by {@link customFetchWithHeaders}. Exposes the
 * decoded body alongside the raw `Headers` object so callers can inspect
 * response metadata (e.g. `X-Metrics-Available` from the queue metrics
 * endpoint — see R5.2 PC.2 / B.2).
 */
export interface FetchResult<T> {
  readonly data: T;
  readonly headers: Headers;
}

async function executeRequestRaw<T>(config: RequestConfig): Promise<FetchResult<T>> {
  const { accessToken } = useAuthStore.getState();
  const { activeTenantId } = useTenantStore.getState();
  const tenantId = activeTenantId ?? useAuthStore.getState().tenantId;

  const url = new URL(config.url, window.location.origin);
  if (config.params) {
    Object.entries(config.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    method: config.method,
    body: config.data ? JSON.stringify(config.data) : undefined,
    signal: config.signal,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...(tenantId && { 'X-Tenant-Id': tenantId }),
    },
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  // Pro v2.4.0-pro + Platform v2.2.0 — LicenseGate middleware returns 402
  // Payment Required with RFC 9457 ProblemDetails carrying tier_required /
  // trial_url / upgrade_url / contact_sales_url extension members. Surface
  // them via the global PaymentRequiredDialogHost so the user sees an
  // actionable upgrade modal instead of a generic error toast.
  if (response.status === 402) {
    const body = await response.json().catch(() => null);
    if (isPaymentRequiredProblemDetails(body)) {
      // The caller may opt out of the global upgrade modal (e.g. an optional
      // license-gated affordance that should silently no-op when unlicensed).
      if (!config.suppressPaymentRequiredModal) {
        usePaymentRequiredStore.getState().show(body);
      }
      throw new PaymentRequiredError(body);
    }
    // Defensive fallback — Platform should never return 402 without a
    // ProblemDetails body, but if it ever does, fail closed with a generic
    // error rather than swallowing it silently.
    throw new Error('Payment Required (malformed response)');
  }

  if (response.status === 204) {
    return { data: undefined as T, headers: response.headers };
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    // The status, Platform's machine code and the `errors` list survive; `message` keeps the
    // value callers have always read (design D1, ADR-0013).
    throw new ApiError(response.status, body);
  }

  const data = (await response.json()) as T;
  return { data, headers: response.headers };
}

async function executeRequest<T>(config: RequestConfig): Promise<T> {
  const result = await executeRequestRaw<T>(config);
  return result.data;
}

/**
 * Pre-flight: make sure a usable token exists before the request goes out.
 *
 * The condition used to be `isTokenExpired() && accessToken`, where the `&& accessToken` term
 * existed to skip the refresh for anonymous callers (the login page). Now that credentials are no
 * longer persisted, that term also excluded the legitimate rehydrated-but-tokenless case, so a
 * request issued while the session was restoring would have travelled unauthenticated. It is keyed
 * on `hasSession()` instead — "we believe there is a session" — and lives in one place because both
 * fetch variants need it and previously duplicated it.
 */
async function ensureTokenBeforeRequest(): Promise<void> {
  const state = useAuthStore.getState();
  if (!state.hasSession()) return;
  if (state.accessToken && !state.isTokenExpired()) return;

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Session expired');
  }
}

export async function customFetch<T>(config: RequestConfig): Promise<T> {
  await ensureTokenBeforeRequest();

  try {
    return await executeRequest<T>(config);
  } catch (err) {
    // On 401: try refresh once
    if (err instanceof UnauthorizedError) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return executeRequest<T>(config);
      }

      useAuthStore.getState().logout();
      window.location.href = '/login';
    }

    throw err;
  }
}

/**
 * Header-aware variant of {@link customFetch}. Returns the parsed body and
 * the raw `Headers` object so callers can inspect response metadata (e.g.
 * `X-Metrics-Available`). Same auth refresh + 401 retry semantics as
 * {@link customFetch}; existing call-sites should keep using `customFetch`
 * unless they need to read response headers.
 */
export async function customFetchWithHeaders<T>(config: RequestConfig): Promise<FetchResult<T>> {
  await ensureTokenBeforeRequest();

  try {
    return await executeRequestRaw<T>(config);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return executeRequestRaw<T>(config);
      }

      useAuthStore.getState().logout();
      window.location.href = '/login';
    }

    throw err;
  }
}
