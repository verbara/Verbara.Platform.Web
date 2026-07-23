import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';

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

/**
 * Migrated to the generated request schema (openapi-typed-client-agent, Platform/ADR-0035):
 * exact match `{ totpCode }`. NB the PROFILE-scoped `ProfileRegenerateRecoveryCodesRequest` — NOT
 * the legacy `RegenerateRecoveryCodesRequest` that binds the `/auth/mfa/...` path.
 */
export type RegenerateRecoveryCodesRequest =
  components['schemas']['ProfileRegenerateRecoveryCodesRequest'];

/**
 * Kept hand-written (openapi-typed-client-agent): POST `/profile/security/recovery-codes/regenerate`
 * declares a `content?: never` 200 response (no response schema); no generated schema models
 * `{ recoveryCodes }`, which the caller reads.
 */
export interface RecoveryCodesPayload {
  recoveryCodes: string[];
}

export function useRegenerateRecoveryCodes() {
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (req: RegenerateRecoveryCodesRequest) =>
      customFetch<RecoveryCodesPayload>({
        url: '/api/v1/profile/security/recovery-codes/regenerate',
        method: 'POST',
        data: req,
      }),
    onSuccess: () => toast.success(t('toasts.auth.recoveryCodesRegenerated')),
    onError: (err: Error) => toast.error(err.message),
  });
}
