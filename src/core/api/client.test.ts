import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { customFetch } from './client';

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      accessToken: 'valid-token',
      tenantId: 'tenant-1',
      isTokenExpired: () => false,
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
