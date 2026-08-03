import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';

export default function UnauthorizedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
        <Button onClick={() => navigate('/')}>{t('errors.go_home')}</Button>
      </div>
    </div>
  );
}
