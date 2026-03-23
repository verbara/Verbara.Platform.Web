import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useUiStore } from '@/core/stores/ui-store';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import type { UserProfile, Features } from './auth-store';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const infoRes = await fetch('/api/admin/system/info', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!infoRes.ok) {
        setError(t('auth.invalid_key'));
        setLoading(false);
        return;
      }

      const info = (await infoRes.json()) as { tenantId?: string; setupComplete?: boolean };

      let user: UserProfile = {
        id: 'admin',
        email: '',
        displayName: 'Admin',
        role: 'admin',
      };

      try {
        const meRes = await fetch('/api/agents/me', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (meRes.ok) {
          const agentData = (await meRes.json()) as {
            id?: string;
            email?: string;
            displayName?: string;
            role?: string;
          };
          user = {
            id: agentData.id ?? 'admin',
            email: agentData.email ?? '',
            displayName: agentData.displayName ?? 'Admin',
            role: agentData.role ?? 'admin',
          };
        }
      } catch {
        // Agent endpoint not available — keep default admin profile
      }

      const tenantId = info.tenantId ?? 'default';
      const features: Features = {};

      useAuthStore.getState().setAuth(apiKey, user, tenantId, features);
      useTenantStore.getState().setActiveTenant(tenantId);

      const setupDismissed = useUiStore.getState().setupDismissed;
      if (info.setupComplete === false && user.role === 'admin' && !setupDismissed) {
        navigate('/admin/setup', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch {
      setError(t('auth.invalid_key'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {t('app.name')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.login')}</p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={t('auth.api_key_placeholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={loading || !apiKey.trim()}
          >
            {loading ? t('status.loading') : t('auth.login')}
          </Button>
        </form>
      </div>
    </div>
  );
}
