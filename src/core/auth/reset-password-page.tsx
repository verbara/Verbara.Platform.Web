import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { CircleCheckBig, CircleX } from 'lucide-react';
import { usePasswordPolicy, type PasswordPolicy } from '@/core/api/hooks/use-auth-admin';

const defaultPolicy: PasswordPolicy = {
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
            <span className={check.met ? 'text-green-600' : 'text-slate-400'}>{check.label}</span>
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
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: policy } = usePasswordPolicy();
  const effectivePolicy = policy ?? defaultPolicy;

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = newPassword.length >= effectivePolicy.minLength && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: token, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '' }));
        setError((err as { detail?: string }).detail || t('auth.reset_error'));
        return;
      }

      navigate('/login', { state: { message: t('auth.password_reset_success') }, replace: true });
    } catch {
      setError(t('auth.reset_error'));
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
            <Label htmlFor="new-password">{t('auth.new_password')}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
            />
            <PasswordStrength password={newPassword} policy={effectivePolicy} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('auth.confirm_password')}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-500">{t('auth.passwords_do_not_match')}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={!canSubmit}
          >
            {loading ? t('status.loading') : t('auth.reset_password')}
          </Button>
        </form>
      </div>
    </div>
  );
}
