import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import type { PaymentRequiredProblemDetails } from './types';

export interface PaymentRequiredDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly problemDetails: PaymentRequiredProblemDetails | null;
}

/**
 * Renders the actionable upgrade dialog when the API returns HTTP 402 Payment
 * Required. CTAs are derived from the ProblemDetails extension members
 * (`trial_url` / `upgrade_url` / `contact_sales_url`) populated by Pro
 * v2.4.0-pro's `LicenseGuard.Evaluate` based on the resolved
 * `LicenseBlockReason`. When the operator's deployment is the issue (e.g.
 * `UnauthorizedImage`), Pro omits all URLs and we render a help-only dialog.
 */
export function PaymentRequiredDialog({
  open,
  onOpenChange,
  problemDetails,
}: PaymentRequiredDialogProps) {
  const { t } = useTranslation('common');

  // Guard: render nothing when no payload is loaded yet (first frame after a
  // dismiss). The Dialog's exit animation keeps the previous content visible
  // via the parent component when `current` is preserved.
  if (!problemDetails) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="payment-required-dialog" />
      </Dialog>
    );
  }

  const trialUrl = problemDetails.trial_url;
  const upgradeUrl = problemDetails.upgrade_url;
  const contactSalesUrl = problemDetails.contact_sales_url;
  const tierRequired = problemDetails.tier_required;

  // When Pro returns no URLs (UnauthorizedImage reason or similar), the user
  // can only acknowledge the message — the remedy is operator-side.
  const hasAnyCta = Boolean(trialUrl || upgradeUrl || contactSalesUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="payment-required-dialog">
        <DialogHeader>
          <DialogTitle>{t('license_required.title')}</DialogTitle>
          <DialogDescription>
            {problemDetails.detail ?? t('license_required.default_detail')}
          </DialogDescription>
          {tierRequired && (
            <p className="text-xs text-muted-foreground" data-testid="payment-required-tier">
              {t('license_required.tier_required', { tier: tierRequired })}
            </p>
          )}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" data-testid="payment-required-dismiss" />}>
            {hasAnyCta ? t('license_required.dismiss') : t('license_required.acknowledge')}
          </DialogClose>
          {contactSalesUrl && (
            <Button
              variant="outline"
              nativeButton={false}
              data-testid="payment-required-contact-sales"
              render={
                <a
                  href={contactSalesUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t('license_required.contact_sales')}
                />
              }
            >
              {t('license_required.contact_sales')}
            </Button>
          )}
          {trialUrl && (
            <Button
              variant="outline"
              nativeButton={false}
              data-testid="payment-required-trial"
              render={
                <a
                  href={trialUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t('license_required.start_trial')}
                />
              }
            >
              {t('license_required.start_trial')}
            </Button>
          )}
          {upgradeUrl && (
            <Button
              variant="default"
              nativeButton={false}
              data-testid="payment-required-upgrade"
              render={
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t('license_required.upgrade')}
                />
              }
            >
              {t('license_required.upgrade')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
