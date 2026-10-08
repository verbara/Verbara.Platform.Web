import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';

import type { LicenseInfo, LicenseStatusSnapshot } from '@/core/api/hooks/use-system';
import { LicenseCard } from '@/admin/system/license-card';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';

import { useTierLabel } from './use-tier-label';

/**
 * The licence tier is read from `LicenseStatusSnapshot.tier`, with the real committed locale
 * files: a known tier is localized, an unknown future value renders raw, a missing tier (or
 * `isLoaded` false) is "Unlicensed", and the licensee is never shown as the tier.
 */

const STATUS = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/license-status-snapshot.v1.json'),
    'utf-8',
  ),
) as LicenseStatusSnapshot;

const LICENSE: LicenseInfo = {
  isValid: true,
  licenseId: 'lic-7f3c2a91',
  licensee: 'Example Contact Ltd',
  status: 'Valid',
  expiresAt: null,
  licensedFeatures: [],
  maxNodes: 3,
  lastValidatedAt: '2026-10-08T06:00:00Z',
  inGrace: false,
  gracePeriodRemaining: null,
  blocked: false,
};

async function renderIn(lng: TestLocale, ui: ReactNode) {
  const i18n = await createLocaleI18n(lng);
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

function TierProbe({ status }: { status: LicenseStatusSnapshot | undefined }) {
  const tierLabel = useTierLabel();
  return <span data-testid="tier">{tierLabel(status)}</span>;
}

describe('licence tier label', () => {
  it.each(TEST_LOCALES)('TierLabel_ShouldLocalizeTheTier_WhenTierIsKnown (%s)', async (lng) => {
    await renderIn(lng, <TierProbe status={STATUS} />);
    expect(screen.getByTestId('tier').textContent).toBe(
      ADMIN_LOCALES[lng].license.tiers.SelfHostBusiness,
    );
  });

  it('TierLabel_ShouldRenderRaw_WhenTierIsUnknown', async () => {
    const future = { ...STATUS, tier: 'FutureTier' } as unknown as LicenseStatusSnapshot;
    await renderIn('en-US', <TierProbe status={future} />);
    expect(screen.getByTestId('tier').textContent).toBe('FutureTier');
  });

  it.each([
    ['no snapshot', undefined],
    ['isLoaded false', { ...STATUS, isLoaded: false }],
    ['no tier', { ...STATUS, tier: undefined }],
  ])('TierLabel_ShouldBeUnlicensed_WhenThereIs %s', async (_, status) => {
    await renderIn('es-419', <TierProbe status={status} />);
    expect(screen.getByTestId('tier').textContent).toBe(
      ADMIN_LOCALES['es-419'].license.tier_unknown,
    );
  });
});

describe('system page licence card', () => {
  it('LicenseCard_ShouldShowTierNotLicensee_WhenStatusHasSelfHostBusiness', async () => {
    await renderIn('en-US', <LicenseCard license={LICENSE} status={STATUS} />);

    const tier = screen.getByTestId('license-tier-value');
    expect(tier.textContent).toBe('Self-host Business');
    expect(tier.textContent).not.toContain('Example Contact Ltd');
    expect(screen.getByTestId('license-licensee').textContent).toContain('Example Contact Ltd');
  });

  it.each(TEST_LOCALES)('LicenseCard_ShouldRenderNoEnglishLiteral_WhenLocaleIs %s', async (lng) => {
    const { container } = await renderIn(lng, <LicenseCard license={LICENSE} status={STATUS} />);
    const admin = ADMIN_LOCALES[lng].license;
    const text = container.textContent ?? '';
    expect(text).toContain(admin.license_id);
    expect(text).toContain(admin.max_nodes);
    expect(text).toContain(admin.card.last_validated);
    expect(text).toContain(admin.perpetual);
    expect(within(container).getByTestId('license-tier-value').textContent).toBe(
      admin.tiers.SelfHostBusiness,
    );
    if (lng !== 'en-US') {
      for (const literal of ['License ID', 'Max Nodes', 'Last Validated', 'Perpetual']) {
        expect(text).not.toContain(literal);
      }
    }
  });
});

describe('licensed-agent copy', () => {
  it.each(TEST_LOCALES)('AdvisoryCopy_ShouldNeverSayTheBandIsBilled (%s)', (lng) => {
    const advisory = ADMIN_LOCALES[lng].license.agents.advisory.toLowerCase();
    for (const word of ['bill', 'factur', 'cobr', 'charge']) {
      expect(advisory).not.toContain(word);
    }
  });
});
