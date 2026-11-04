import { useQueryClient } from '@tanstack/react-query';
import { isApiError } from './api-error';

/**
 * The retry of a conversation read: a 403 or a 404 is Platform's answer, and asking again only delays
 * showing it. Anything else keeps the client's default.
 */
export function useReadRetry() {
  const retry = useQueryClient().getDefaultOptions().queries?.retry;
  return (failureCount: number, error: Error): boolean => {
    if (isApiError(error) && (error.status === 403 || error.status === 404)) return false;
    if (typeof retry === 'function') return Boolean(retry(failureCount, error));
    if (typeof retry === 'number') return failureCount < retry;
    return retry ?? failureCount < 3;
  };
}
