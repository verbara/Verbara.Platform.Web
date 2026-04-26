import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

/**
 * Tenant MFA policy snapshot exposed by the backend in `/users/me` so the Web
 * can hide the "Disable MFA" affordance proactively when tenant policy
 * enforces MFA — instead of relying on a 403 round-trip from the existing
 * policy enforcer.
 *
 * `policySource` is `"tenant"` when the tenant-level policy mandates MFA, and
 * `"user"` otherwise (the user can opt-in/out individually). R5.2 PA.1 / E.2.
 */
export interface MfaPolicy {
  enforced: boolean;
  policySource: 'tenant' | 'user';
}

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
  /** R5.2 E.2 — added to /users/me; older backends may omit it (treat as undefined). */
  mfaPolicy?: MfaPolicy;
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

/**
 * Returns true when the tenant MFA policy enforces MFA for this user (i.e.
 * the "Disable MFA" affordance must be hidden). Defaults to `false` when the
 * field is absent — older backends that haven't shipped the addition.
 */
export function isMfaEnforcedByTenant(me: Me | undefined): boolean {
  return me?.mfaPolicy?.enforced === true && me.mfaPolicy.policySource === 'tenant';
}
