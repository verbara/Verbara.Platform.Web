/**
 * Typed reads for test values the checker cannot prove are present: an indexed element under
 * `noUncheckedIndexedAccess`, an optional entry of a lookup table, the n-th call of a mock.
 *
 * Each one throws when the value is not there, so a test that reads something missing fails at
 * the read with a message that says what was missing, instead of passing `undefined` on to a
 * later assertion (or a `!` that only silences the checker).
 */

/** `value`, or a thrown error naming `what` when it is undefined. */
export function defined<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) {
    throw new Error(`expected ${what} to be defined`);
  }
  return value;
}

/** The arguments of a mock's call at `index` (0 = first), or a thrown error when it has fewer. */
export function nthCall<A extends readonly unknown[]>(
  mock: { mock: { calls: readonly A[] } },
  index = 0,
): A {
  const call = mock.mock.calls[index];
  if (call === undefined) {
    throw new Error(`expected mock call #${index + 1}, got ${mock.mock.calls.length} call(s)`);
  }
  return call;
}
