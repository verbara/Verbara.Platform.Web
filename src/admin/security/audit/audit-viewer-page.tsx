import { useTranslation } from 'react-i18next';
import { PlaceholderPage } from '@/admin/shared/placeholder-page';

export default function AuditViewerPage() {
  const { t } = useTranslation(['admin']);
  return (
    <PlaceholderPage
      title={t('admin:security_admin.audit.title')}
      featureName="R5.2 — Audit Log Viewer"
    />
  );
}
