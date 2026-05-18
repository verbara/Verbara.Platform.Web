import { usePaymentRequiredStore } from './payment-required-store';
import { PaymentRequiredDialog } from './payment-required-dialog';

/**
 * Mount this once near the application root (after the i18n + theme providers).
 * Subscribes to the singleton `usePaymentRequiredStore` and renders the
 * `<PaymentRequiredDialog />` accordingly. Bridges the non-React API client
 * (`core/api/client.ts` throws `PaymentRequiredError`) into the React render
 * tree without each feature having to wire its own modal.
 */
export function PaymentRequiredDialogHost() {
  const open = usePaymentRequiredStore((s) => s.open);
  const current = usePaymentRequiredStore((s) => s.current);
  const dismiss = usePaymentRequiredStore((s) => s.dismiss);

  return (
    <PaymentRequiredDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
      problemDetails={current}
    />
  );
}
