import { isApiError, type ApiErrorEntry, type ApiErrorMap } from './api-error';

/**
 * The silent-listen refusals (host change `supervisor-silent-listen`, design D7; design D5 here;
 * spec `conversation-action-feedback`). Each is identified by the machine code in the body's
 * `error`, read by {@link ApiError} into `err.code` (ADR-0013). The body's `conversationId` and
 * `listenId` are facts of the refusal, never shown as text.
 */
export type SupervisorListenCode =
  | 'not-permitted'
  | 'invalid-destination'
  | 'voice-unavailable'
  | 'not-leader'
  | 'conversation-not-found'
  | 'no-voice-call'
  | 'already-listening'
  | 'no-supervisor-endpoint'
  | 'no-listen-phone'
  | 'no-trunk'
  | 'originate-failed'
  | 'listen-not-found';

const entry = (code: string): ApiErrorEntry => ({
  code,
  key: `common:errors.supervisor_listen.${code.replaceAll('-', '_')}`,
});

const LISTEN_CODES: readonly SupervisorListenCode[] = [
  'not-permitted',
  'invalid-destination',
  'voice-unavailable',
  'not-leader',
  'conversation-not-found',
  'no-voice-call',
  'already-listening',
  'no-supervisor-endpoint',
  'no-listen-phone',
  'no-trunk',
  'originate-failed',
  'listen-not-found',
];

/**
 * The closed map for provisioning the listen endpoint and starting, reading or stopping a listen.
 * A code it does not know, or a failure without one, shows the generic `listen-failed`.
 * `listen-not-found` from the current and stop routes is "no active listen" and is handled by the
 * caller before this map is consulted.
 */
export const supervisorListenRefusals: ApiErrorMap = {
  codes: Object.fromEntries(LISTEN_CODES.map((code) => [code, entry(code)])),
  fallback: entry('listen-failed'),
};

/**
 * The closed map for the admin listen-phone routes: 400 `listen-phone-invalid`, a bare 404 for a
 * user not in the tenant, and the generic failure for anything else.
 */
export const listenPhoneRefusals: ApiErrorMap = {
  codes: { 'listen-phone-invalid': entry('listen-phone-invalid') },
  statuses: { 404: entry('user-not-found') },
  fallback: entry('listen-phone-failed'),
};

/** The existing listen an `already-listening` refusal names, from its facts; else `null`. */
export function alreadyListeningOf(
  err: unknown,
): { conversationId: string | null; listenId: string | null } | null {
  if (!isApiError(err) || err.code !== 'already-listening') return null;
  const text = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
  return { conversationId: text(err.facts.conversationId), listenId: text(err.facts.listenId) };
}
