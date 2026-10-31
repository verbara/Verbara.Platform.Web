/**
 * What the session manager asks a domain: is the agent busy, and tell me when
 * they become busy. A domain registers its source when its code loads, which can
 * be long after the session manager's effect ran (the agent console is a lazy
 * route), so a subscriber reaches every source whenever each one arrives.
 */
export interface ActiveWorkSource {
  /** True while the domain holds work that must keep the session alive. */
  isActive(): boolean;
  /** Calls `onBecameActive` on each transition into active; returns the unsubscribe. */
  subscribe(onBecameActive: () => void): () => void;
}

const sources = new Set<ActiveWorkSource>();
const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  for (const subscriber of subscribers) subscriber();
}

/** Adds a source for the rest of the page's life, or until the returned function runs. */
export function registerActiveWorkSource(source: ActiveWorkSource): () => void {
  sources.add(source);
  const unsubscribe = source.subscribe(notifySubscribers);
  return () => {
    unsubscribe();
    sources.delete(source);
  };
}

/** True when any registered source reports active work. */
export function isAnyWorkActive(): boolean {
  for (const source of sources) {
    if (source.isActive()) return true;
  }
  return false;
}

/** Subscribes to every source's transition into active, present and future. */
export function subscribeToActiveWork(onBecameActive: () => void): () => void {
  subscribers.add(onBecameActive);
  return () => subscribers.delete(onBecameActive);
}
