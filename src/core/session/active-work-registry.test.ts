import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAnyWorkActive,
  registerActiveWorkSource,
  subscribeToActiveWork,
  type ActiveWorkSource,
} from './active-work-registry';

function makeFakeSource() {
  let active = false;
  const listeners = new Set<() => void>();
  const source: ActiveWorkSource = {
    isActive: () => active,
    subscribe: (onBecameActive) => {
      listeners.add(onBecameActive);
      return () => listeners.delete(onBecameActive);
    },
  };
  return {
    source,
    listenerCount: () => listeners.size,
    setActive(next: boolean) {
      const became = next && !active;
      active = next;
      if (became) for (const listener of listeners) listener();
    },
  };
}

describe('active-work registry', () => {
  let cleanups: (() => void)[] = [];

  function register(source: ActiveWorkSource) {
    const unregister = registerActiveWorkSource(source);
    cleanups.push(unregister);
    return unregister;
  }

  function subscribe(listener: () => void) {
    const unsubscribe = subscribeToActiveWork(listener);
    cleanups.push(unsubscribe);
    return unsubscribe;
  }

  afterEach(() => {
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
  });

  it('isAnyWorkActive_ShouldBeFalse_WhenNoSourceIsRegistered', () => {
    expect(isAnyWorkActive()).toBe(false);
  });

  it('isAnyWorkActive_ShouldBeTrue_WhenAnyOneSourceIsActive', () => {
    const idle = makeFakeSource();
    const busy = makeFakeSource();
    register(idle.source);
    register(busy.source);
    expect(isAnyWorkActive()).toBe(false);

    busy.setActive(true);

    expect(isAnyWorkActive()).toBe(true);
  });

  it('subscribeToActiveWork_ShouldReachASource_WhenItRegisteredBeforeTheSubscriber', () => {
    const fake = makeFakeSource();
    register(fake.source);
    const listener = vi.fn();
    subscribe(listener);

    fake.setActive(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribeToActiveWork_ShouldReachASource_WhenItRegisteredAfterTheSubscriber', () => {
    const listener = vi.fn();
    subscribe(listener);
    const fake = makeFakeSource();
    register(fake.source);

    fake.setActive(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribeToActiveWork_ShouldStopNotifying_WhenUnsubscribed', () => {
    const fake = makeFakeSource();
    register(fake.source);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();
    fake.setActive(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('registerActiveWorkSource_ShouldDropTheSource_WhenUnregistered', () => {
    const fake = makeFakeSource();
    const unregister = register(fake.source);
    fake.setActive(true);
    expect(fake.listenerCount()).toBe(1);

    unregister();

    expect(isAnyWorkActive()).toBe(false);
    expect(fake.listenerCount()).toBe(0);
  });
});
