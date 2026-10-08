import { useTranslation } from 'react-i18next';

/**
 * The notice shown when an impersonation ends without the operator asking (its expiry, or Platform
 * refusing its token): localized text inside an element carrying
 * `data-notice-code="impersonation-ended"`, identical in every locale (design D3).
 */
export function ImpersonationEndedNotice() {
  const { t } = useTranslation('common');
  return <span data-notice-code="impersonation-ended">{t('impersonation.ended')}</span>;
}
