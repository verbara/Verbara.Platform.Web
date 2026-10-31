import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/core/auth/auth-store';
import { roleDefaultRoute } from '@/core/auth/role-default-route';
import { useDocumentTitle } from '@/core/hooks/use-document-title';
import { Button } from '@/core/ui/button';

export default function UnauthorizedPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('title.unauthorized'));
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  return (
    <div
      data-testid="unauthorized-page"
      className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4"
    >
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
          {t('errors.unauthorized_title')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">{t('errors.unauthorized_description')}</p>
        <Button data-testid="unauthorized-go-home" onClick={() => navigate(roleDefaultRoute(role))}>
          {t('errors.go_home')}
        </Button>
      </div>
    </div>
  );
}
