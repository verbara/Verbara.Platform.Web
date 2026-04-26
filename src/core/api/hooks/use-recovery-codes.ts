import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customFetch } from '@/core/api/client';

/**
 * Profile-scoped recovery-codes regenerate hook backing
 * `/profile/security/recovery-codes/regenerate` (R5.2 PA.2).
 *
 * Differs from the legacy `useRegenerateRecoveryCodes` in `use-auth-admin.ts`:
 * the new endpoint requires a fresh TOTP step-up (not a password) — matching
 * the modern UX where the user is already in an authenticated route and only
 * needs to prove possession of the second factor.
 *
 * On 401 with `{ mfaStepUpRequired: true }` the caller should prompt for the
 * TOTP code and retry; the surface intentionally surfaces that contract via
 * the typed response below.
 */

export interface RegenerateRecoveryCodesRequest {
  totpCode: string;
}

export interface RecoveryCodesPayload {
  recoveryCodes: string[];
}

export function useRegenerateRecoveryCodes() {
  return useMutation({
    mutationFn: (req: RegenerateRecoveryCodesRequest) =>
      customFetch<RecoveryCodesPayload>({
        url: '/api/v1/profile/security/recovery-codes/regenerate',
        method: 'POST',
        data: req,
      }),
    onSuccess: () => toast.success('Recovery codes regenerated'),
    onError: (err: Error) => toast.error(err.message),
  });
}
