// The licence tier label, read from `LicenseStatusSnapshot.tier` (never from `licensee`, which is
// the licensee's name). Shared by the licence page's Tier card and the system page's licence card.
//
// - no snapshot, `isLoaded` false, or no `tier` → the existing "Unlicensed" label;
// - a known `LicenseTier` → its localized label under `admin:license.tiers.*`;
// - an unknown future value → rendered as received (i18next `defaultValue`), never a throw.

import { useTranslation } from 'react-i18next';

import type { LicenseStatusSnapshot } from '@/core/api/hooks/use-system';

export function useTierLabel(): (status: LicenseStatusSnapshot | undefined) => string {
  const { t } = useTranslation(['admin']);
  return (status) => {
    const tier = status?.tier;
    if (!status || status.isLoaded === false || !tier) return t('admin:license.tier_unknown');
    return t(`admin:license.tiers.${tier}`, { defaultValue: tier });
  };
}
