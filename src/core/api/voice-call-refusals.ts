import { isApiError, type ApiErrorEntry, type ApiErrorMap } from './api-error';
import { CONTACT_CONSENT_WITHDRAWN, CONTACT_DO_NOT_CONTACT } from './contact-write-refusals';

/**
 * The click-to-dial and voice-transfer refusals (host change `outbound-calls-reach-the-trunk`,
 * fixture `voice-dial-transfer.v1.json`; design D1-D3 here; spec `conversation-action-feedback`).
 * Each map knows `trunk-not-dialable`, read by {@link ApiError} into `err.code` (ADR-0013),
 * whatever the status. Every other failure falls back to the message shown before this change.
 */
export const TRUNK_NOT_DIALABLE: ApiErrorEntry = {
  code: 'trunk-not-dialable',
  key: 'common:errors.voice.trunk_not_dialable',
};

/**
 * `POST /api/v1/voice/dial` (click-to-dial). It also knows the contact's own refusals, a contact who
 * asked not to be contacted or withdrew consent on Voice (host change
 * `contacts-writes-follow-their-permissions`, fixture `do-not-contact-refusals.v1.json`; design W6).
 */
export const voiceDialRefusals: ApiErrorMap = {
  codes: {
    'trunk-not-dialable': TRUNK_NOT_DIALABLE,
    [CONTACT_DO_NOT_CONTACT.code]: CONTACT_DO_NOT_CONTACT,
    [CONTACT_CONSENT_WITHDRAWN.code]: CONTACT_CONSENT_WITHDRAWN,
  },
  fallback: { code: 'dial-failed', key: 'agent:voice.dial_failed' },
};

/** `POST /api/v1/conversations/{id}/voice-transfer` (blind transfer to an external number). */
export const voiceTransferRefusals: ApiErrorMap = {
  codes: { 'trunk-not-dialable': TRUNK_NOT_DIALABLE },
  fallback: { code: 'voice-transfer-failed', key: 'agent:voice.transfer.failed' },
};

/**
 * The values the `trunk-not-dialable` message names, from the refusal's facts only (design D3):
 * `{ trunkId }` when `err` is that refusal, else `{}`. The server's text is never read.
 */
export function trunkRefusalValues(err: unknown): Record<string, unknown> {
  if (!isApiError(err) || err.code !== TRUNK_NOT_DIALABLE.code) return {};
  return { trunkId: err.facts.trunkId };
}
