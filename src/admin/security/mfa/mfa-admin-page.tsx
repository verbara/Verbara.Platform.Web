import { useTranslation } from 'react-i18next';
import { PlaceholderPage } from '@/admin/shared/placeholder-page';

export default function MfaAdminPage() {
  const { t } = useTranslation(['admin']);
  return (
    <PlaceholderPage
      title={t('admin:security_admin.mfa.title')}
      featureName="R5.2 — MFA Administration"
    />
  );
}
