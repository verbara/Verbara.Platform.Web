import { queryClient } from '@/core/api/query-client';

/**
 * What one person or tenant leaves in the page. A sign-out or an identity change happens without a
 * reload, so whatever the previous identity loaded would otherwise be drawn for the next one.
 *
 * A store registers its own reset when its code loads, as {@link registerActiveWorkSource} does: most
 * stores live in lazy routes, the auth store cannot import them (they reach it back through the request
 * client), and a store whose chunk never loaded holds nothing. This module imports nothing else from
 * the app, so anything can import it.
 */
const resets = new Set<() => void>();

/** Adds a reset for the rest of the page's life. It runs on sign-out and on every identity change. */
export function registerSessionWorkReset(reset: () => void): void {
  resets.add(reset);
}

function resetStores(): void {
  for (const reset of resets) reset();
}

/**
 * Sign-out: nothing is left to read, so no query is read again. A read still in flight is dropped with
 * its query, and its answer reaches no cache. An open page leaves with the route change.
 */
export function clearSessionWork(): void {
  resetStores();
  queryClient.clear();
}

/**
 * The identity behind the requests changed and the page stays open (an impersonation, a tenant switch):
 * call it once the new token or tenant is in place. An open page shows its loading state and reads again
 * as the new identity, with no reader seeing the previous one's data while it does; a read in flight is
 * dropped. Mutations stay, because the one that started the impersonation is still running.
 */
export function clearWorkOfPreviousIdentity(): void {
  resetStores();
  queryClient.removeQueries({ predicate: (query) => query.getObserversCount() === 0 });
  void queryClient.resetQueries();
}
