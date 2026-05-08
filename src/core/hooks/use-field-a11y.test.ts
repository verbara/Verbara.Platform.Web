import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFieldA11y } from './use-field-a11y';

describe('useFieldA11y', () => {
  it('Returns_UndefinedAriaProps_WhenNoErrorAndNotRequired', () => {
    const { result } = renderHook(() => useFieldA11y(undefined, 'email'));
    expect(result.current.inputProps['aria-invalid']).toBeUndefined();
    expect(result.current.inputProps['aria-describedby']).toBeUndefined();
    expect(result.current.inputProps['aria-required']).toBeUndefined();
    expect(result.current.errorId).toBe('email-error');
  });

  it('Returns_AriaInvalidAndDescribedBy_WhenErrorPresent', () => {
    const { result } = renderHook(() => useFieldA11y({ message: 'required' }, 'email'));
    expect(result.current.inputProps['aria-invalid']).toBe(true);
    expect(result.current.inputProps['aria-describedby']).toBe('email-error');
  });

  it('Returns_AriaRequired_WhenRequiredFlagSet_RegardlessOfError', () => {
    const { result: noError } = renderHook(() =>
      useFieldA11y(undefined, 'email', { required: true }),
    );
    expect(noError.current.inputProps['aria-required']).toBe(true);

    const { result: withError } = renderHook(() =>
      useFieldA11y({ message: 'x' }, 'email', { required: true }),
    );
    expect(withError.current.inputProps['aria-required']).toBe(true);
    expect(withError.current.inputProps['aria-invalid']).toBe(true);
  });
});
