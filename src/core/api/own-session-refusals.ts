import type { ApiErrorMap } from './api-error';

/**
 * `DELETE /api/v1/auth/sessions/{tokenId}` refused because the token is the session the
 * `refresh_token` cookie names (host fixture `own-session-revoke.v1.json`, outcome
 * `sessionIsCurrent`): nothing was revoked; the client refreshes the list.
 */
export const SESSION_IS_CURRENT = 'session-is-current';

/**
 * The closed refusal map of the own-session revoke route (spec `own-session-console`, design D-2):
 * the `session-is-current` code, a `404` (the session already ended or is not the caller's), and a
 * generic failure for anything else. A `401` is handled by the client's refresh-and-retry and
 * falls to the fallback if it surfaces. Platform's text is never shown.
 */
export const ownSessionRefusals: ApiErrorMap = {
  codes: {
    [SESSION_IS_CURRENT]: {
      code: SESSION_IS_CURRENT,
      key: 'errors.own_session.session_is_current',
    },
  },
  statuses: {
    404: { code: 'session-not-found', key: 'errors.own_session.not_found' },
  },
  fallback: { code: 'session-revoke-failed', key: 'errors.own_session.revoke_failed' },
};
