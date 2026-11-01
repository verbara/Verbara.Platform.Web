import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './use-debounced-value';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ShouldReturnTheFirstValueAtOnce_WhenMounted', () => {
    const { result } = renderHook(() => useDebouncedValue('a'));
    expect(result.current).toBe('a');
  });

  it('ShouldHoldTheOldValue_UntilTheDelayPasses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('ShouldSettleOnTheLastValue_WhenTheValueChangesInsideTheDelay', () => {
    const seen: string[] = [];
    const { rerender } = renderHook(
      ({ value }) => {
        const debounced = useDebouncedValue(value);
        seen.push(debounced);
        return debounced;
      },
      { initialProps: { value: 'b' } },
    );
    for (const value of ['bi', 'bil', 'bill']) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(200);
      });
    }
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect([...new Set(seen)]).toEqual(['b', 'bill']);
  });

  it('ShouldHonourTheDelayGiven_WhenNotTheDefault', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 50), {
      initialProps: { value: 1 },
    });
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(2);
  });
});
