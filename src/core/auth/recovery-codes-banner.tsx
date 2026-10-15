import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { KeyRound, X } from 'lucide-react';
import { useAuthStore } from './auth-store';
import { useMe } from '@/core/api/hooks/use-me';

const REGENERATE_PATH = '/profile/security/recovery-codes/regenerate';
const STORAGE_PREFIX = 'verbara.recoveryCodesBanner.dismissed';

/**
 * Dismissals recorded for this page session when browser storage cannot be read or written, so a
 * dismissed banner stays hidden while the user navigates (design D5).
 */
const sessionDismissals = new Set<string>();

function dismissalKey(tenantId: string | null, userId: string | undefined): string {
  return `${STORAGE_PREFIX}:${tenantId ?? ''}:${userId ?? ''}`;
}

function isDismissed(key: string): boolean {
  if (sessionDismissals.has(key)) return true;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function recordDismissal(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    sessionDismissals.add(key);
  }
}

/**
 * Non-blocking prompt shown while `GET /api/v1/users/me` reports `recoveryCodesNeedRegeneration:
 * true`. Hidden while an impersonation is active and once dismissed for this user in this tenant on
 * this browser (design D5).
 */
export function RecoveryCodesBanner() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const impersonation = useAuthStore((s) => s.impersonation);
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id);
  const key = dismissalKey(tenantId, userId);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  if (me?.recoveryCodesNeedRegeneration !== true) return null;
  if (impersonation) return null;
  if (dismissedKey === key || isDismissed(key)) return null;

  const handleDismiss = () => {
    recordDismissal(key);
    setDismissedKey(key);
  };

  return (
    <div
      role="status"
      data-testid="recovery-codes-banner"
      data-print="hide"
      className="flex items-center justify-center gap-3 bg-sky-600 px-4 py-2 text-sm font-medium text-white"
    >
      <KeyRound className="h-4 w-4" aria-hidden="true" />
      <span>{t('recovery_codes_banner.message')}</span>
      <Link
        to={REGENERATE_PATH}
        data-testid="recovery-codes-banner-regenerate"
        className="rounded bg-sky-700 px-2 py-0.5 text-xs font-medium text-white underline-offset-2 hover:underline"
      >
        {t('recovery_codes_banner.regenerate')}
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        data-testid="recovery-codes-banner-dismiss"
        aria-label={t('recovery_codes_banner.dismiss')}
        className="ml-2 inline-flex items-center rounded p-0.5 text-white transition-colors hover:bg-sky-700"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
