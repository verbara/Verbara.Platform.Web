import type { ApiErrorEntry, ApiErrorMap } from './api-error';

/**
 * The contact writes' refusals (host change `contacts-writes-follow-their-permissions`, fixtures
 * `contact-write-refusals.v1.json`, `contact-channel-consent.v1.json`, `contact-opt-out.v1.json`;
 * design W1, W6 here; spec `console-contact-writes`). One closed map for `POST /api/v1/contacts`,
 * `PUT` and `DELETE /api/v1/contacts/{id}` and `POST /api/v1/contacts/{id}/opt-out`: the routes answer
 * with the same codes in the same order. The server's text is never shown, nor the `details` of
 * `unknown-consent-channel`: they name keys the console sent, nothing an operator can act on.
 */
export const contactWriteRefusals: ApiErrorMap = {
  codes: {
    'not-permitted': { code: 'not-permitted', key: 'common:errors.contacts.not_permitted' },
    'unknown-consent-channel': {
      code: 'unknown-consent-channel',
      key: 'common:errors.contacts.unknown_consent_channel',
    },
  },
  statuses: {
    // `PUT` and the opt-out on an id no contact of the tenant has: no body.
    404: { code: '404', key: 'common:errors.contacts.not_found' },
  },
  fallback: { code: 'contact-write-failed', key: 'common:errors.contacts.write_failed' },
};

/**
 * A call or a new conversation refused because the contact asked not to be contacted (fixture
 * `do-not-contact-refusals.v1.json`, `dial`, `start`). Shared by the dial and conversation maps.
 */
export const CONTACT_DO_NOT_CONTACT: ApiErrorEntry = {
  code: 'contact-do-not-contact',
  key: 'common:errors.contacts.do_not_contact',
};

/** The same, because the contact withdrew consent on that channel (`dialConsentWithdrawn`, `startConsentWithdrawn`). */
export const CONTACT_CONSENT_WITHDRAWN: ApiErrorEntry = {
  code: 'contact-consent-withdrawn',
  key: 'common:errors.contacts.consent_withdrawn',
};
