import { useTranslation } from 'react-i18next';
import { PlaceholderPage } from '@/admin/shared/placeholder-page';

export default function RegeneratePage() {
  const { t } = useTranslation(['admin']);
  return (
    <PlaceholderPage
      title={t('admin:profile_security.recovery_codes.regenerate.title')}
      featureName="R5.2 — Regenerate Recovery Codes"
    />
  );
}
