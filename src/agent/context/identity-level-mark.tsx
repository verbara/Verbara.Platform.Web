import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/core/ui/badge';

/**
 * How sure the platform is of who a contact is (W7). Spans only and no focusable part, because a past
 * conversation's row is a `<button>`, and the same chip serves every placement. The browser's own `title` is
 * the tooltip. Anything but the two levels renders nothing, so a future level can never read as verified.
 */
export function IdentityLevelMark({ identityLevel }: { identityLevel?: string | undefined }) {
  const { t } = useTranslation(['agent']);

  const mark =
    identityLevel === 'Unverified'
      ? {
          Icon: ShieldAlert,
          text: t('agent:identity.unverified'),
          hint: t('agent:identity.unverified_hint'),
          colors:
            'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        }
      : identityLevel === 'Verified'
        ? {
            Icon: ShieldCheck,
            text: t('agent:identity.verified'),
            hint: t('agent:identity.verified_hint'),
            colors:
              'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          }
        : null;
  if (!mark) return null;

  const { Icon, text, hint, colors } = mark;
  return (
    <Badge
      variant="outline"
      role="img"
      data-identity-level={identityLevel}
      aria-label={hint}
      title={hint}
      className={colors}
    >
      <Icon aria-hidden="true" />
      {text}
    </Badge>
  );
}
