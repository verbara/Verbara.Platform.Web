import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFieldA11y } from './use-field-a11y';

describe('useFieldA11y', () => {
  it('NoErrorNoRequired_EmptyProps', () => {
    const { result } = renderHook(() => useFieldA11y(false, 'f1', {}));
    expect(result.current.fieldProps).toEqual({});
    expect(result.current.errorId).toBe('f1-error');
  });

  it('Required_AddsAriaRequired', () => {
    const { result } = renderHook(() => useFieldA11y(false, 'f1', { required: true }));
    expect(result.current.fieldProps['aria-required']).toBe('true');
    expect(result.current.fieldProps['aria-invalid']).toBeUndefined();
  });

  it('Error_AddsAriaInvalidAndDescribedby', () => {
    const { result } = renderHook(() => useFieldA11y(true, 'f1', {}));
    expect(result.current.fieldProps['aria-invalid']).toBe('true');
    expect(result.current.fieldProps['aria-describedby']).toBe('f1-error');
  });

  it('RequiredAndError_AllProps', () => {
    const { result } = renderHook(() => useFieldA11y(true, 'f1', { required: true }));
    expect(result.current.fieldProps).toEqual({
      'aria-required': 'true',
      'aria-invalid': 'true',
      'aria-describedby': 'f1-error',
    });
  });
});
