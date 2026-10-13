import { isApiError, type ApiErrorEntry, type ApiErrorMap } from './api-error';

/**
 * The click-to-dial and voice-transfer refusals (host change `outbound-calls-reach-the-trunk`,
 * fixture `voice-dial-transfer.v1.json`; design D1-D3 here; spec `conversation-action-feedback`).
 * Each map knows only `trunk-not-dialable`, read by {@link ApiError} into `err.code` (ADR-0013),
 * whatever the status. Every other failure falls back to the message shown before this change.
 */
export const TRUNK_NOT_DIALABLE: ApiErrorEntry = {
  code: 'trunk-not-dialable',
  key: 'common:errors.voice.trunk_not_dialable',
};

/** `POST /api/v1/voice/dial` (click-to-dial). */
export const voiceDialRefusals: ApiErrorMap = {
  codes: { 'trunk-not-dialable': TRUNK_NOT_DIALABLE },
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
