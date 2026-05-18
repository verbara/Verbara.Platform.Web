import { describe, expect, it } from 'vitest';
import { isPaymentRequiredProblemDetails } from './types';

describe('isPaymentRequiredProblemDetails', () => {
  it('should_ReturnTrue_WhenValidShape', () => {
    const valid = {
      type: 'https://verbara.io/problems/license-required',
      title: 'Feature Not Licensed',
      status: 402,
      detail: "The 'Dialer' feature is not included in your current license.",
    };
    expect(isPaymentRequiredProblemDetails(valid)).toBe(true);
  });

  it('should_ReturnTrue_WhenExtensionMembersOmitted', () => {
    // UnauthorizedImage reason: Pro omits all URLs intentionally.
    expect(
      isPaymentRequiredProblemDetails({
        type: 'https://verbara.io/problems/license-required',
        title: 'Feature Not Licensed',
        status: 402,
      }),
    ).toBe(true);
  });

  it('should_ReturnFalse_WhenStatusNot402', () => {
    expect(
      isPaymentRequiredProblemDetails({
        title: 'Forbidden',
        status: 403,
      }),
    ).toBe(false);
  });

  it('should_ReturnFalse_WhenMissingStatus', () => {
    expect(
      isPaymentRequiredProblemDetails({
        title: 'Feature Not Licensed',
      }),
    ).toBe(false);
  });

  it('should_ReturnFalse_WhenMissingTitle', () => {
    expect(
      isPaymentRequiredProblemDetails({
        status: 402,
      }),
    ).toBe(false);
  });

  it('should_ReturnFalse_WhenNull', () => {
    expect(isPaymentRequiredProblemDetails(null)).toBe(false);
  });

  it('should_ReturnFalse_WhenPrimitive', () => {
    expect(isPaymentRequiredProblemDetails('Payment Required')).toBe(false);
    expect(isPaymentRequiredProblemDetails(402)).toBe(false);
  });
});
