import type { ApiErrorEntry, ApiErrorMap } from './api-error';

/**
 * The refusals of the supervisor's text whisper, `POST /api/v1/supervisor/sessions/{sessionId}/whisper`
 * (host change `supervisor-whisper-reaches-the-agent`, fixture `supervisor-whisper.v1.json`; design
 * D2 here). The console maps by status alone and never reads the body (fixture `_note`, ADR-0013):
 * every refusal the host defines has its own status. The 400 and 409
 * codes reuse the host's own words so logs and tests read the same; the 404 code is the console's.
 */
const entry = (code: string): ApiErrorEntry => ({
  code,
  key: `common:errors.supervisor_whisper.${code.replaceAll('-', '_')}`,
});

export const WHISPER_TEXT_INVALID = entry('whisper-text-invalid');
export const WHISPER_SESSION_NOT_FOUND = entry('whisper-session-not-found');
export const WHISPER_SESSION_NOT_BOUND = entry('whisper-session-not-bound');
export const WHISPER_FAILED = entry('whisper-failed');

/** The closed map: 400, 404 and 409 by status; anything else is the generic `whisper-failed`. */
export const supervisorWhisperRefusals: ApiErrorMap = {
  statuses: {
    400: WHISPER_TEXT_INVALID,
    404: WHISPER_SESSION_NOT_FOUND,
    409: WHISPER_SESSION_NOT_BOUND,
  },
  fallback: WHISPER_FAILED,
};

/** The host's bound on the whisper text, in UTF-16 code units (host design D7). */
export const WHISPER_MAX_LENGTH = 500;
