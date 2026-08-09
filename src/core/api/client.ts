import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { SessionChannel } from '@/core/session/session-channel';
import {
  PaymentRequiredError,
  isPaymentRequiredProblemDetails,
  usePaymentRequiredStore,
} from '@/core/licensing';

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

/**
 * Performs the actual network refresh: POST `/auth/refresh`, parse the new
 * token, push it into the auth store, and broadcast `'refreshed'` to other
 * tabs so they reschedule their proactive-refresh timers. Returns `true` when
 * the token is now valid, `false` on any failure. Never throws.
 *
 * This is the body extracted from the original `refreshAccessToken`; the
 * existing `sessionIdleTimeoutMinutes` handling is preserved verbatim.
 */
async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) return false;

    const data = (await res.json()) as {
      accessToken: string;
      expiresAt: string;
      permissions?: string[];
      sessionIdleTimeoutMinutes?: number;
    };

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
    const body = await response.json().catch(() => null);
    const msg =
      body?.detail ??
      body?.error ??
      (Array.isArray(body?.errors)
        ? body.errors
            .map((e: unknown) =>
              typeof e === 'object' && e !== null && 'message' in e
                ? (e as { message?: unknown }).message
                : e,
            )
            .filter(Boolean)
            .join('; ') || undefined
        : undefined) ??
      `API error: ${response.status}`;
    throw new Error(msg);
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
