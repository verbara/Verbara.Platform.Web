import { useTranslation } from 'react-i18next';
import { PlaceholderPage } from '@/admin/shared/placeholder-page';

export default function MfaEnrollWizard() {
  const { t } = useTranslation(['admin']);
  return (
    <PlaceholderPage
      title={t('admin:profile_security.mfa.enroll.title')}
      featureName="R5.2 — Enroll MFA Wizard"
    />
  );
}
