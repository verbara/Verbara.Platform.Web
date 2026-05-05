import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { SetupBanner } from '@/admin/setup/setup-banner';

export default function AdminHomePage() {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('home.title', 'Dashboard')}
        description={t('home.subtitle', 'Welcome to the administration panel.')}
      />
      <SetupBanner />
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <div className="text-center text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">{t('home.placeholder', 'Dashboard widgets coming soon.')}</p>
        </div>
      </div>
    </div>
  );
}
