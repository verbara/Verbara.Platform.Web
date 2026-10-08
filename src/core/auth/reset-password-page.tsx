import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { CircleCheckBig, CircleX } from 'lucide-react';
import { type PasswordPolicy } from '@/core/api/hooks/use-auth-admin';
import { RESET_REFUSAL_KEYS, resetRefusalCode, type ResetRefusalCode } from './sign-in-refusal';

// The generic hint shown while resetting. The tenant's own policy cannot be read here: the person
// following a reset link has no session, and `GET /api/v1/auth/password-policy` requires one (it
// resolves the tenant from the token) — loading it through `customFetch` answered 401, which signs
// out and redirects to /login before the form could be used. Platform still validates the new
// password against the tenant's policy and the page shows its error.
const resetPolicy: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: true,
};

function PasswordStrength({ password, policy }: { password: string; policy: PasswordPolicy }) {
  const { t } = useTranslation();

  const checks = useMemo(() => {
    const items = [
      {
        key: 'length',
        label: t('admin:security.password_too_short', { n: policy.minLength }),
        met: password.length >= policy.minLength,
      },
    ];
    if (policy.requireUppercase)
      items.push({
        key: 'upper',
        label: t('admin:security.password_needs_uppercase'),
        met: /[A-Z]/.test(password),
      });
    if (policy.requireNumber)
      items.push({
        key: 'number',
        label: t('admin:security.password_needs_number'),
        met: /\d/.test(password),
      });
    if (policy.requireSpecial)
      items.push({
        key: 'special',
        label: t('admin:security.password_needs_special'),
        met: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      });
    return items;
  }, [password, policy, t]);

  const score = checks.filter((c) => c.met).length;
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-400', 'bg-green-500'];

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < score ? colors[score] : 'bg-slate-200 dark:bg-slate-700'}`}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {checks.map((check) => (
          <li key={check.key} className="flex items-center gap-1.5 text-xs">
            {check.met ? (
              <CircleCheckBig className="h-3 w-3 text-green-500" />
            ) : (
              <CircleX className="h-3 w-3 text-slate-300" />
            )}
            <span className={check.met ? 'text-green-600' : 'text-slate-500'}>{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Platform 2.24.x mailed the Base64 token unencoded, and the query parser reads its '+' as a
  // space. Base64 never contains a space, so a space can only be a '+' that lost its meaning in
  // transit; restoring it keeps those links working. Platform 2.25.0 percent-encodes the token
  // ('%2B'), which decodes straight to '+' and is untouched by this.
  const token = (searchParams.get('token') ?? '').replaceAll(' ', '+');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // A code, never display text: it picks the translation and is exposed as `data-error-code`.
  const [errorCode, setErrorCode] = useState<ResetRefusalCode | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = newPassword.length >= resetPolicy.minLength && passwordsMatch && !loading;

  const mismatchError =
    confirmPassword && !passwordsMatch ? { message: 'auth.passwords_do_not_match' } : undefined;

  const newPasswordA11y = useFieldA11y(undefined, 'reset-new-password', { required: true });
  const confirmPasswordA11y = useFieldA11y(mismatchError, 'reset-confirm-password', {
    required: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) return;
    setErrorCode(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Platform's ResetPasswordRequest(Token, NewPassword), camelCase on the wire.
        body: JSON.stringify({ token, newPassword }),
      });

      if (!res.ok) {
        // The status and the body's shape decide; Platform's English `error` text is never shown.
        const body: unknown = await res.json().catch(() => null);
        setErrorCode(resetRefusalCode(res.status, body));
        return;
      }

      navigate('/login', { state: { message: t('auth.password_reset_success') }, replace: true });
    } catch {
      setErrorCode(resetRefusalCode(null, null));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <p className="text-sm text-red-500">{t('auth.reset_token_missing')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {t('auth.reset_password')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('auth.reset_password_description')}
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="space-y-2">
            <Label htmlFor="reset-new-password" required>
              {t('auth.new_password')}
            </Label>
            <Input
              id="reset-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              {...newPasswordA11y.inputProps}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- standalone page: focus first field on mount for keyboard users
              autoFocus
              data-testid="reset-new-password"
            />
            <PasswordStrength password={newPassword} policy={resetPolicy} />
            <FieldError id={newPasswordA11y.errorId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-confirm-password" required>
              {t('auth.confirm_password')}
            </Label>
            <Input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              {...confirmPasswordA11y.inputProps}
              data-testid="reset-confirm-password"
            />
            <FieldError
              id={confirmPasswordA11y.errorId}
              message={mismatchError ? t(mismatchError.message) : undefined}
            />
          </div>

          {errorCode && (
            <p
              className="text-sm text-red-600 dark:text-red-400"
              data-testid="reset-error"
              data-error-code={errorCode}
            >
              {t(RESET_REFUSAL_KEYS[errorCode])}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={!canSubmit}
            data-testid="reset-submit"
          >
            {loading ? t('status.loading') : t('auth.reset_password')}
          </Button>
        </form>
      </div>
    </div>
  );
}
