import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally swallow — always show success
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {t('auth.forgot_password')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('auth.forgot_password_description')}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-900">
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t('auth.reset_email_sent')}
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={loading || !email.trim()}
              >
                {loading ? t('status.loading') : t('auth.send_reset_link')}
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('auth.back_to_login')}
          </button>
        </div>
      </div>
    </div>
  );
}
