import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PaymentRequiredDialog } from './payment-required-dialog';
import type { PaymentRequiredProblemDetails } from './types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

function buildDetails(
  overrides: Partial<PaymentRequiredProblemDetails> = {},
): PaymentRequiredProblemDetails {
  return {
    type: 'https://verbara.io/problems/license-required',
    title: 'Feature Not Licensed',
    status: 402,
    detail: "The 'Dialer' feature is not included in your current license.",
    instance: '/api/v1/admin/dialer/campaigns',
    ...overrides,
  };
}

describe('PaymentRequiredDialog', () => {
  it('should_RenderUpgradeAndTrialButtons_WhenUrlsPresent', () => {
    render(
      <PaymentRequiredDialog
        open={true}
        onOpenChange={() => undefined}
        problemDetails={buildDetails({
          trial_url: 'https://verbara.io/developer-license',
          upgrade_url: 'https://verbara.io/pricing',
        })}
      />,
    );
    expect(screen.getByTestId('payment-required-upgrade')).toHaveAttribute(
      'href',
      'https://verbara.io/pricing',
    );
    expect(screen.getByTestId('payment-required-trial')).toHaveAttribute(
      'href',
      'https://verbara.io/developer-license',
    );
    expect(screen.queryByTestId('payment-required-contact-sales')).toBeNull();
  });

  it('should_RenderContactSales_WhenRevokedScenario', () => {
    render(
      <PaymentRequiredDialog
        open={true}
        onOpenChange={() => undefined}
        problemDetails={buildDetails({
          contact_sales_url: 'https://verbara.io/contact-sales',
        })}
      />,
    );
    expect(screen.getByTestId('payment-required-contact-sales')).toHaveAttribute(
      'href',
      'https://verbara.io/contact-sales',
    );
    expect(screen.queryByTestId('payment-required-trial')).toBeNull();
    expect(screen.queryByTestId('payment-required-upgrade')).toBeNull();
  });

  it('should_OmitAllCtaButtons_WhenUnauthorizedImageScenario', () => {
    // Pro's LicenseGuard.Evaluate returns no URLs for UnauthorizedImage —
    // the operator's remedy is to redeploy, not upgrade.
    render(
      <PaymentRequiredDialog
        open={true}
        onOpenChange={() => undefined}
        problemDetails={buildDetails()}
      />,
    );
    expect(screen.queryByTestId('payment-required-trial')).toBeNull();
    expect(screen.queryByTestId('payment-required-upgrade')).toBeNull();
    expect(screen.queryByTestId('payment-required-contact-sales')).toBeNull();
    // Still has dismiss/acknowledge so the user can close.
    expect(screen.getByTestId('payment-required-dismiss')).toBeTruthy();
  });

  it('should_RenderTierRequiredLabel_WhenTierProvided', () => {
    render(
      <PaymentRequiredDialog
        open={true}
        onOpenChange={() => undefined}
        problemDetails={buildDetails({ tier_required: 'Developer' })}
      />,
    );
    const tier = screen.getByTestId('payment-required-tier');
    // i18n mock returns `key:vars` — assert the variable made it through.
    expect(tier.textContent).toContain('Developer');
  });

  it('should_RenderEmptyContent_WhenProblemDetailsNull', () => {
    // Mid-dismissal frame: store cleared `current` but the Dialog is still
    // closing. Component must not crash on null.
    const { container } = render(
      <PaymentRequiredDialog open={false} onOpenChange={() => undefined} problemDetails={null} />,
    );
    expect(container).toBeTruthy();
  });
});
