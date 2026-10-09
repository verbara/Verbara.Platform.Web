import { toast } from 'sonner';
import { useAuthStore } from './auth-store';
import { ImpersonationEndedNotice } from './impersonation-ended-notice';

/**
 * Thrown instead of sending (or re-sending) a request whose impersonation is over: Platform refused
 * the impersonation token with 401, or the token passed its expiry (design D3). The request is
 * never replayed with the operator's own token; the operator is back in their own session.
 */
export class ImpersonationEndedError extends Error {
  constructor() {
    super('Impersonation ended');
    this.name = 'ImpersonationEndedError';
  }
}

/**
 * Ends the active impersonation in this tab without a server call and tells the operator why
 * (H17, design D3): the store restores the operator's token, its expiry and tenant
 * (`endImpersonation`), and a notice carrying `data-notice-code="impersonation-ended"` is shown.
 * Used by the request client when Platform refuses the impersonation token and by the banner's
 * countdown at the expiry. The hub restarts under the operator through its principal key
 * (ADR-0012 §1).
 *
 * Returns whether an impersonation was active; concurrent refusals end it, and notify, once.
 */
export function endImpersonationLocally(): boolean {
  if (!useAuthStore.getState().impersonation?.active) return false;
  useAuthStore.getState().endImpersonation();
  toast.info(<ImpersonationEndedNotice />);
  return true;
}
