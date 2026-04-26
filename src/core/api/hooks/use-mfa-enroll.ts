import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customFetch } from '@/core/api/client';

/**
 * Hooks for the profile-scoped MFA enrollment wizard at
 * `/profile/security/mfa/enroll` (R5.2 PA.2).
 *
 * Wraps the 3-step state machine exposed by `MfaEnrollEndpoints`:
 *   1. `/init`     → fresh secret + QR + manual code (not yet committed)
 *   2. `/verify`   → validates TOTP, persists secret + recovery codes
 *   3. `/complete` → flips `MfaEnabled = true` after user acks codes
 *
 * The split between verify and complete lets the wizard re-issue the
 * codes-display step on remount/refresh without losing the enrollment.
 */

export interface MfaEnrollInitResponse {
  secret: string;
  qrUri: string;
  manualCode: string;
}

export interface MfaEnrollVerifyRequest {
  secret: string;
  totpCode: string;
}

export interface MfaEnrollVerifyResponse {
  recoveryCodes: string[];
}

export function useMfaEnrollInit() {
  return useMutation({
    mutationFn: () =>
      customFetch<MfaEnrollInitResponse>({
        url: '/api/v1/profile/security/mfa/enroll/init',
        method: 'POST',
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMfaEnrollVerify() {
  return useMutation({
    mutationFn: (req: MfaEnrollVerifyRequest) =>
      customFetch<MfaEnrollVerifyResponse>({
        url: '/api/v1/profile/security/mfa/enroll/verify',
        method: 'POST',
        data: req,
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMfaEnrollComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/profile/security/mfa/enroll/complete',
        method: 'POST',
        data: { acknowledged: true },
      }),
    onSuccess: () => {
      // /users/me now reports MFA enabled — refresh so any UI that gates on
      // mfaEnabled reflects the new state immediately.
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
