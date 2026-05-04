import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/v1/auth/refresh', () =>
    HttpResponse.json({
      accessToken: 'new-token',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      permissions: ['users:user:view'],
    }),
  ),
  http.get('/api/v1/users/me', () =>
    HttpResponse.json({ id: 'u1', email: 'test@example.com', displayName: 'Test' }),
  ),
];

export const server = setupServer(...handlers);
