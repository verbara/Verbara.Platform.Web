import { useTranslation } from 'react-i18next';
import { PlaceholderPage } from '@/admin/shared/placeholder-page';

export default function ImpersonationAdminPage() {
  const { t } = useTranslation(['admin']);
  return (
    <PlaceholderPage
      title={t('admin:security_admin.impersonation.title')}
      featureName="R5.2 — Impersonation Sessions"
    />
  );
}
