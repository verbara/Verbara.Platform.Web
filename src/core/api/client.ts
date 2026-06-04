import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
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
}

class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

let _refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
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
          data.permissions ?? store.permissions,
          store.features,
          data.sessionIdleTimeoutMinutes ?? store.sessionIdleTimeoutMinutes,
        );
      }
      return true;
    } catch {
      return false;
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
      usePaymentRequiredStore.getState().show(body);
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
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? `API error: ${response.status}`);
  }

  const data = (await response.json()) as T;
  return { data, headers: response.headers };
}

async function executeRequest<T>(config: RequestConfig): Promise<T> {
  const result = await executeRequestRaw<T>(config);
  return result.data;
}

export async function customFetch<T>(config: RequestConfig): Promise<T> {
  // Pre-flight: refresh if token expired
  if (useAuthStore.getState().isTokenExpired() && useAuthStore.getState().accessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

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
  if (useAuthStore.getState().isTokenExpired() && useAuthStore.getState().accessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

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
