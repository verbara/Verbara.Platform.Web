import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { customFetch, customFetchWithHeaders } from './client';
import { ApiError } from './api-error';
import { PaymentRequiredError, usePaymentRequiredStore } from '@/core/licensing';

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      accessToken: 'valid-token',
      tenantId: 'tenant-1',
      isTokenExpired: () => false,
      // Mirrors the real selector: "there is a session worth restoring", keyed on the persisted user.
      hasSession: () => true,
      user: { id: 'u1', email: 'test@example.com' },
      permissions: [],
      features: {},
      setAuth: vi.fn(),
      logout: vi.fn(),
    })),
  },
}));

vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: {
    getState: vi.fn(() => ({ activeTenantId: null })),
  },
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('customFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make GET request and return parsed JSON', async () => {
    server.use(http.get('/api/v1/test', () => HttpResponse.json({ value: 42 })));

    const result = await customFetch<{ value: number }>({
      url: '/api/v1/test',
      method: 'GET',
    });

    expect(result).toEqual({ value: 42 });
  });

  it('should make POST request with body', async () => {
    server.use(
      http.post('/api/v1/test', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ id: '1', ...(body as object) });
      }),
    );

    const result = await customFetch<{ id: string; name: string }>({
      url: '/api/v1/test',
      method: 'POST',
      data: { name: 'hello' },
    });

    expect(result).toEqual({ id: '1', name: 'hello' });
  });

  it('should append query params', async () => {
    server.use(
      http.get('/api/v1/test', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({ page: url.searchParams.get('page') });
      }),
    );

    const result = await customFetch<{ page: string }>({
      url: '/api/v1/test',
      method: 'GET',
      params: { page: '2' },
    });

    expect(result).toEqual({ page: '2' });
  });

  it('should throw on non-ok response with detail', async () => {
    server.use(
      http.get('/api/v1/test', () => HttpResponse.json({ detail: 'Not found' }, { status: 404 })),
    );

    await expect(customFetch({ url: '/api/v1/test', method: 'GET' })).rejects.toThrow('Not found');
  });

  it('should surface field-level errors[].message on non-ok response', async () => {
    server.use(
      http.post('/api/v1/test', () =>
        HttpResponse.json({ errors: [{ field: 'x', message: 'Required' }] }, { status: 400 }),
      ),
    );

    await expect(customFetch({ url: '/api/v1/test', method: 'POST', data: {} })).rejects.toThrow(
      'Required',
    );
  });

  it('should return undefined for 204 No Content', async () => {
    server.use(http.delete('/api/v1/test/1', () => new HttpResponse(null, { status: 204 })));

    const result = await customFetch<void>({
      url: '/api/v1/test/1',
      method: 'DELETE',
    });

    expect(result).toBeUndefined();
  });

  it('should include Authorization header', async () => {
    let authHeader: string | null = null;
    server.use(
      http.get('/api/v1/test', ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );

    await customFetch({ url: '/api/v1/test', method: 'GET' });
    expect(authHeader).toBe('Bearer valid-token');
  });

  it('should include X-Tenant-Id header', async () => {
    let tenantHeader: string | null = null;
    server.use(
      http.get('/api/v1/test', ({ request }) => {
        tenantHeader = request.headers.get('X-Tenant-Id');
        return HttpResponse.json({});
      }),
    );

    await customFetch({ url: '/api/v1/test', method: 'GET' });
    expect(tenantHeader).toBe('tenant-1');
  });

  it('should attempt refresh on 401 and retry', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/v1/test', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({}, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({
          accessToken: 'refreshed-token',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
      ),
    );

    const result = await customFetch<{ ok: boolean }>({
      url: '/api/v1/test',
      method: 'GET',
    });

    expect(result).toEqual({ ok: true });
    expect(callCount).toBe(2);
  });
});

describe('customFetch refusals as ApiError (design D1)', () => {
  async function refusal(status: number, body: unknown): Promise<unknown> {
    server.use(http.post('/api/v1/refused', () => HttpResponse.json(body, { status })));
    return customFetch({ url: '/api/v1/refused', method: 'POST', data: {} }).catch(
      (e: unknown) => e,
    );
  }

  it('should carry the status and the machine code when the error is a hyphenated code', async () => {
    const err = await refusal(403, { error: 'not-offered-to-you' });

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'not-offered-to-you', errors: null });
    // The message callers have always read is unchanged.
    expect((err as ApiError).message).toBe('not-offered-to-you');
  });

  it('should never turn prose into a code when the error is English text', async () => {
    const err = await refusal(400, { error: 'Cannot hold conversation' });

    expect(err).toMatchObject({ status: 400, code: null, message: 'Cannot hold conversation' });
  });

  it('should carry the errors list and keep the joined message when the body has field errors', async () => {
    const err = await refusal(400, {
      errors: [
        { field: 'reason', message: 'Reason is required' },
        { field: 'notes', message: 'Too long' },
      ],
    });

    expect(err).toMatchObject({ status: 400, code: null });
    expect((err as ApiError).errors).toEqual([
      { field: 'reason', message: 'Reason is required' },
      { field: 'notes', message: 'Too long' },
    ]);
    expect((err as ApiError).message).toBe('Reason is required; Too long');
  });

  it('should keep the ProblemDetails detail as the message when Platform answers 412', async () => {
    const err = await refusal(412, {
      title: 'User changed',
      detail: 'Read the user again.',
      status: 412,
    });

    expect(err).toMatchObject({ status: 412, code: null, message: 'Read the user again.' });
  });

  it('should fall back to the status message when the body is not JSON', async () => {
    server.use(http.post('/api/v1/refused', () => new HttpResponse('oops', { status: 500 })));

    const err = await customFetch({ url: '/api/v1/refused', method: 'POST', data: {} }).catch(
      (e: unknown) => e,
    );

    expect(err).toMatchObject({ status: 500, code: null, errors: null, message: 'API error: 500' });
  });

  it('should throw the same ApiError through customFetchWithHeaders', async () => {
    server.use(
      http.get('/api/v1/refused', () => HttpResponse.json({ error: 'not-owner' }, { status: 403 })),
    );

    const err = await customFetchWithHeaders({ url: '/api/v1/refused', method: 'GET' }).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'not-owner' });
  });

  it('should still throw PaymentRequiredError, not ApiError, when Platform answers 402', async () => {
    const err = await refusal(402, {
      type: 'https://verbara.io/errors/license-required',
      title: 'Payment Required',
      status: 402,
      tier_required: 'Professional',
    });

    expect(err).toBeInstanceOf(PaymentRequiredError);
    expect(err).not.toBeInstanceOf(ApiError);
    usePaymentRequiredStore.getState().dismiss();
  });

  it('should still return undefined when Platform answers 204', async () => {
    server.use(http.post('/api/v1/refused', () => new HttpResponse(null, { status: 204 })));

    await expect(
      customFetch({ url: '/api/v1/refused', method: 'POST', data: {} }),
    ).resolves.toBeUndefined();
  });

  it('should still refresh and retry once, never surfacing ApiError, when Platform answers 401', async () => {
    let calls = 0;
    server.use(
      http.post('/api/v1/refused', () => {
        calls++;
        return calls === 1
          ? HttpResponse.json({}, { status: 401 })
          : HttpResponse.json({ ok: true });
      }),
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({
          accessToken: 'refreshed-token',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
      ),
    );

    await expect(
      customFetch({ url: '/api/v1/refused', method: 'POST', data: {} }),
    ).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
  });
});
