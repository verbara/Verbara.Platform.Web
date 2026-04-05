import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';

interface LoginResponse {
  accessToken?: string;
  expiresAt?: string;
  user?: { id: string; email: string; displayName: string; role: string };
  tenantId?: string;
  permissions?: string[];
  features?: Record<string, boolean>;
}

interface MfaVerifyProps {
  mfaToken: string;
  email: string;
  onSuccess: (data: LoginResponse) => void;
  onCancel: () => void;
}

export function MfaVerify({ mfaToken, email: _email, onSuccess, onCancel }: MfaVerifyProps) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function verifyCode(code: string) {
    setError('');
    setLoading(true);
    try {
      const body = recoveryMode
        ? { mfaToken, recoveryCode: code }
        : { mfaToken, code };

      const res = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError(t('auth.mfa_invalid_code'));
        setDigits(Array(6).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }

      const data = (await res.json()) as LoginResponse;
      onSuccess(data);
    } catch {
      setError(t('auth.mfa_error'));
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
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-10 rounded-lg border border-slate-200 bg-transparent text-center text-lg font-mono outline-none focus:border-brand focus:ring-2 focus:ring-brand/50 dark:border-slate-700 dark:bg-slate-800"
              autoFocus={i === 0}
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
            autoFocus
          />
          <Button
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={loading || !recoveryCode.trim()}
            onClick={() => void verifyCode(recoveryCode)}
          >
            {loading ? t('status.loading') : t('auth.mfa_verify')}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-center text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex flex-col items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setRecoveryMode((v) => !v);
            setError('');
          }}
          className="text-xs text-brand hover:underline"
        >
          {recoveryMode ? t('auth.mfa_use_code') : t('auth.mfa_use_recovery')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:underline"
        >
          {t('actions.cancel')}
        </button>
      </div>
    </div>
  );
}
