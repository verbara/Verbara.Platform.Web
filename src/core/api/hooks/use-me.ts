import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  mfaConfirmedAt: string | null;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  authProvider: 'local' | 'oidc' | 'apikey';
  externalId: string | null;
  oidcSubject: string | null;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => customFetch<Me>({ url: '/api/v1/users/me', method: 'GET' }),
    staleTime: 60_000,
  });
}

export function isLockedOut(me: Me | undefined): boolean {
  if (!me?.lockedUntil) return false;
  return new Date(me.lockedUntil).getTime() > Date.now();
}
