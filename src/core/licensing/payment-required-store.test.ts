import { beforeEach, describe, expect, it } from 'vitest';
import { usePaymentRequiredStore } from './payment-required-store';
import type { PaymentRequiredProblemDetails } from './types';

const SAMPLE: PaymentRequiredProblemDetails = {
  type: 'https://verbara.io/problems/license-required',
  title: 'Feature Not Licensed',
  status: 402,
  detail: "The 'Dialer' feature is not included in your current license.",
  instance: '/api/v1/admin/dialer/campaigns',
  trial_url: 'https://verbara.io/developer-license',
  upgrade_url: 'https://verbara.io/pricing',
};

describe('usePaymentRequiredStore', () => {
  beforeEach(() => usePaymentRequiredStore.getState().dismiss());

  it('should_StartClosed_WhenStoreInitialised', () => {
    const s = usePaymentRequiredStore.getState();
    expect(s.open).toBe(false);
    // current may carry a stale payload from a prior test's show() call
    // since dismiss() preserves `current` for exit animation continuity —
    // open=false is the canonical "modal hidden" signal.
  });

  it('should_OpenWithPayload_WhenShowCalled', () => {
    usePaymentRequiredStore.getState().show(SAMPLE);
    const s = usePaymentRequiredStore.getState();
    expect(s.open).toBe(true);
    expect(s.current).toEqual(SAMPLE);
  });

  it('should_ReplaceCurrent_WhenShowCalledTwice', () => {
    const second: PaymentRequiredProblemDetails = {
      ...SAMPLE,
      detail: "The 'CallAnalytics' feature is not included in your current license.",
      instance: '/api/v1/admin/call-analytics/sessions',
    };
    usePaymentRequiredStore.getState().show(SAMPLE);
    usePaymentRequiredStore.getState().show(second);
    expect(usePaymentRequiredStore.getState().current).toEqual(second);
    expect(usePaymentRequiredStore.getState().open).toBe(true);
  });

  it('should_CloseButKeepPayload_WhenDismissed', () => {
    usePaymentRequiredStore.getState().show(SAMPLE);
    usePaymentRequiredStore.getState().dismiss();
    const s = usePaymentRequiredStore.getState();
    expect(s.open).toBe(false);
    // Payload retained so the exit animation has stable content.
    expect(s.current).toEqual(SAMPLE);
  });

  it('should_Reopen_WhenShowCalledAfterDismiss', () => {
    usePaymentRequiredStore.getState().show(SAMPLE);
    usePaymentRequiredStore.getState().dismiss();
    usePaymentRequiredStore.getState().show(SAMPLE);
    expect(usePaymentRequiredStore.getState().open).toBe(true);
  });
});
