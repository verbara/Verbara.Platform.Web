import { useTranslation } from 'react-i18next';
import { PlaceholderPage } from '@/admin/shared/placeholder-page';

export default function RetentionAdminPage() {
  const { t } = useTranslation(['admin']);
  return (
    <PlaceholderPage
      title={t('admin:retention.title')}
      featureName="R5.2 — Retention Policy"
    />
  );
}
