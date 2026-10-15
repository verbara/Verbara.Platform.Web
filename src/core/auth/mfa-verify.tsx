import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  MFA_STEP_ERROR_KEYS,
  mfaVerifyOutcome,
  type MfaStepErrorCode,
  type SignInErrorCode,
} from './sign-in-refusal';

interface LoginResponse {
  accessToken?: string;
  expiresAt?: string;
  user?: { id: string; email: string; displayName: string; role: string };
  tenantId?: string;
  permissions?: string[];
  features?: Record<string, boolean>;
  /** Per-tenant idle-logout threshold; carried through `completeLogin` so MFA logins honor it. */
  sessionIdleTimeoutMinutes?: number;
}

interface MfaVerifyProps {
  mfaToken: string;
  email: string;
  /** The tenant the sign-in named, sent as `X-Tenant-Id`; none is sent when it named none. */
  tenantId?: string;
  onSuccess: (data: LoginResponse) => void;
  onCancel: () => void;
  /**
   * The sign-in was refused for good: Platform answered 403 (the account, or its tenant, may not
   * sign in) or 423 (the account is locked), so another code cannot succeed. The caller leaves the
   * MFA step, clears the pending challenge and shows the code on the sign-in form.
   */
  onRefused: (code: SignInErrorCode) => void;
}

export function MfaVerify({
  mfaToken,
  email: _email,
  tenantId,
  onSuccess,
  onCancel,
  onRefused,
}: MfaVerifyProps) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  // A code, never display text: it picks the translation and is exposed as `data-error-code`.
  const [errorCode, setErrorCode] = useState<MfaStepErrorCode | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // The delayed return to sign-in after a spent challenge. Cancelled when the step unmounts, so it
  // never fires into a later sign-in.
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (returnTimerRef.current !== null) clearTimeout(returnTimerRef.current);
    },
    [],
  );

  async function verifyCode(code: string) {
    setErrorCode(null);
    setLoading(true);
    try {
      const body = recoveryMode ? { mfaToken, recoveryCode: code } : { mfaToken, code };

      const res = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantId && { 'X-Tenant-Id': tenantId }),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // The body is read once; `null` when it is absent or not JSON. Only its machine code is used.
        let refusalBody: unknown = null;
        try {
          refusalBody = await res.json();
        } catch {
          refusalBody = null;
        }

        const outcome = mfaVerifyOutcome(res.status, refusalBody);

        // A 403 or 423 is final for the console. The account 403 (and the 423) spends the
        // challenge; a tenant 403 leaves it live on the server, but a retry cannot succeed while
        // the tenant is in that state. Either way the step closes and the sign-in form shows it.
        if (outcome.kind === 'refused') {
          onRefused(outcome.code);
          return;
        }

        setErrorCode(outcome.code);
        setDigits(Array(6).fill(''));
        if (outcome.clearPending) {
          // The challenge cannot succeed any more: let the user read why, then return to sign-in.
          // Only this challenge is cleared: a newer one in the store is left alone.
          if (returnTimerRef.current !== null) clearTimeout(returnTimerRef.current);
          returnTimerRef.current = setTimeout(() => {
            returnTimerRef.current = null;
            const store = useAuthStore.getState();
            if (store.mfaPending?.mfaToken === mfaToken) store.clearMfaPending();
          }, 3000);
          return;
        }
        inputRefs.current[0]?.focus();
        return;
      }

      const data = (await res.json()) as LoginResponse;
      onSuccess(data);
    } catch {
      setErrorCode('mfa-error');
    } finally {
      setLoading(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;

    const next = [...digits];
    next[index] = value;
    setDigits(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && next.every((d) => d !== '')) {
      void verifyCode(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const next = pasted.split('');
      setDigits(next);
      void verifyCode(pasted);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-center space-y-1">
        <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t('auth.mfa_title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {recoveryMode ? t('auth.mfa_recovery_prompt') : t('auth.mfa_prompt')}
        </p>
      </div>

      {!recoveryMode ? (
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              {...(i === 0 ? { autoComplete: 'one-time-code' } : { autoComplete: 'off' })}
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-10 rounded-lg border border-slate-200 bg-transparent text-center text-lg font-mono outline-none focus:border-brand focus:ring-2 focus:ring-brand/50 dark:border-slate-700 dark:bg-slate-800"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- standalone page: focus first OTP digit on mount for keyboard users
              autoFocus={i === 0}
              data-testid={`login-mfa-digit-${i}`}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            type="text"
            placeholder={t('auth.mfa_recovery_placeholder')}
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- standalone page: focus recovery input on mode switch for keyboard users
            autoFocus
            data-testid="login-mfa-recovery-input"
          />
          <Button
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={loading || !recoveryCode.trim()}
            onClick={() => void verifyCode(recoveryCode)}
            data-testid="login-mfa-submit"
          >
            {loading ? t('status.loading') : t('auth.mfa_verify')}
          </Button>
        </div>
      )}

      {errorCode && (
        <p
          className="text-sm text-center text-red-600 dark:text-red-400"
          data-testid="login-mfa-error"
          data-error-code={errorCode}
        >
          {t(MFA_STEP_ERROR_KEYS[errorCode])}
        </p>
      )}

      <div className="flex flex-col items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setRecoveryMode((v) => !v);
            setErrorCode(null);
          }}
          className="text-xs text-brand-dark hover:underline"
          data-testid="login-mfa-use-recovery"
        >
          {recoveryMode ? t('auth.mfa_use_code') : t('auth.mfa_use_recovery')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:underline"
          data-testid="login-mfa-cancel"
        >
          {t('actions.cancel')}
        </button>
      </div>
    </div>
  );
}
