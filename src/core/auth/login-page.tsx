import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { resolveDefaultTenant } from '../tenant/resolve-tenant';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Checkbox } from '@/core/ui/checkbox';
import { MfaVerify } from './mfa-verify';
import { ChevronDown } from 'lucide-react';
import type { UserProfile, Features } from './auth-store';

interface LoginResponse {
  accessToken?: string;
  expiresAt?: string;
  requiresMfa?: boolean;
  mfaToken?: string;
  user?: UserProfile;
  tenantId?: string;
  permissions?: string[];
  features?: Features;
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const mfaPending = useAuthStore((s) => s.mfaPending);
  const rememberMe = useAuthStore((s) => s.rememberMe);

  const successMessage = (location.state as { message?: string } | null)?.message;

  const roleDefaultRoute: Record<string, string> = {
    admin: '/admin',
    supervisor: '/operations',
    agent: '/agent',
  };

  // Handle OIDC callback token
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      void handleOidcCallback(token);
    }
  }, [searchParams]);

  function completeLogin(data: LoginResponse) {
    if (!data.accessToken || !data.user || !data.tenantId) return;

    const expiry = data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 900000;
    useAuthStore.getState().setAuth(
      data.accessToken,
      expiry,
      data.user,
      data.tenantId,
      data.permissions ?? [],
      data.features ?? {},
    );
    useTenantStore.getState().setActiveTenant(data.tenantId);

    const from =
      (location.state as { from?: { pathname: string } })?.from?.pathname ??
      roleDefaultRoute[data.user.role] ??
      '/agent';

    navigate(from, { replace: true });
  }

  async function handleOidcCallback(token: string) {
    try {
      const res = await fetch('/api/auth/oidc/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = (await res.json()) as LoginResponse;
        completeLogin(data);
      }
    } catch {
      setError(t('auth.sso_error'));
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tenant = resolveDefaultTenant();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(tenant && { 'X-Tenant-Id': tenant }),
        },
        body: JSON.stringify({ tenantId: tenant, email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '' }));
        setError((err as { detail?: string }).detail || t('auth.invalid_credentials'));
        return;
      }

      const data = (await res.json()) as LoginResponse;

      if (data.requiresMfa && data.mfaToken) {
        useAuthStore.getState().setMfaPending(data.mfaToken, email);
        return;
      }

      completeLogin(data);
    } catch {
      setError(t('auth.invalid_credentials'));
    } finally {
      setLoading(false);
    }
  }

  async function handleApiKeyLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login/apikey', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      if (!res.ok) {
        setError(t('auth.invalid_key'));
        return;
      }

      const data = (await res.json()) as LoginResponse;
      completeLogin(data);
    } catch {
      setError(t('auth.invalid_key'));
    } finally {
      setLoading(false);
    }
  }

  function handleSsoLogin() {
    window.location.href = '/api/auth/oidc/login';
  }

  // MFA verification modal
  if (mfaPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-full max-w-sm" data-testid="login-mfa-section">
          <MfaVerify
            mfaToken={mfaPending.mfaToken}
            email={mfaPending.email}
            onSuccess={completeLogin}
            onCancel={() => useAuthStore.getState().clearMfaPending()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {t('app.name')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.sign_in')}</p>
        </div>

        {successMessage && (
          <p className="text-sm text-center text-green-600 dark:text-green-400">{successMessage}</p>
        )}

        {/* Email/Password form */}
        <form
          onSubmit={(e) => void handleEmailLogin(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('auth.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              data-testid="login-email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-brand hover:underline"
                data-testid="login-forgot-password"
              >
                {t('auth.forgot_password')}
              </button>
            </div>
            <Input
              id="password"
              type="password"
              placeholder={t('auth.password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) =>
                useAuthStore.getState().setRememberMe(checked === true)
              }
            />
            <Label htmlFor="remember-me" className="text-sm font-normal">
              {t('auth.remember_me')}
            </Label>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" data-testid="login-error">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={loading || !email.trim() || !password.trim()}
            data-testid="login-submit"
          >
            {loading ? t('status.loading') : t('auth.sign_in')}
          </Button>

          {/* SSO button */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                {t('auth.or')}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleSsoLogin}
            data-testid="login-sso-button"
          >
            {t('auth.sign_in_sso')}
          </Button>
        </form>

        {/* Collapsible API Key section */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-3 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            data-testid="login-apikey-toggle"
          >
            {t('auth.use_api_key')}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showApiKey ? '' : '-rotate-90'}`}
            />
          </button>
          {showApiKey && (
            <form
              onSubmit={(e) => void handleApiKeyLogin(e)}
              className="border-t border-slate-200 p-6 space-y-4 dark:border-slate-800"
            >
              <div className="space-y-2">
                <Label htmlFor="api-key">{t('auth.api_key')}</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder={t('auth.api_key_placeholder')}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  data-testid="login-apikey-input"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={loading || !apiKey.trim()}
                data-testid="login-apikey-submit"
              >
                {loading ? t('status.loading') : t('auth.sign_in')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
