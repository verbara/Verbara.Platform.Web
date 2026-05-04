import type { Mock } from 'vitest';

export function asMock<T extends (...args: never[]) => unknown>(fn: T): Mock {
  return fn as unknown as Mock;
}
