import { useTranslation } from 'react-i18next';
import { PlaceholderPage } from '@/admin/shared/placeholder-page';

export default function UserSessionsPage() {
  const { t } = useTranslation(['admin']);
  return (
    <PlaceholderPage
      title={t('admin:profile_security.sessions.title')}
      featureName="R5.2 — User Sessions"
    />
  );
}
