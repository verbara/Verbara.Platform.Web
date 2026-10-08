/**
 * A refusal from Platform, as the console reports it (design D1, ADR-0013).
 *
 * Platform's error bodies mix two things: machine codes (`ErrorResponse { error: "not-owner" }`) and
 * English prose (`ErrorResponse { error: "Cannot hold conversation" }`, a ProblemDetails `detail`, a
 * typify `errors[].message`, a password policy's `details[]`). Only the first is a contract.
 * {@link ApiError} keeps the HTTP status, the machine code when the body carries one, and the item
 * list (`errors`, else `details`); the message shown to a user
 * comes from a closed map keyed by those ({@link describeApiError}), never from the server's text.
 *
 * `message` keeps the value the client produced before this type existed (`detail`, else `error`,
 * else the joined `errors[].message`, else `API error: <status>`), so callers that still render
 * `err.message` behave as before until they move to a map.
 */

/**
 * One item of a refusal's list: typify's `{ field, message }` (`TypifyErrorResponse.errors`), or a
 * policy message string (`ErrorDetailResponse.details`).
 */
export type ApiErrorItem = { readonly field?: string; readonly message?: string } | string;

/**
 * A machine code is lower-case words joined by hyphens (`not-owner`, `target-queue-not-found`).
 * At least one hyphen is required, so a single word or any prose ("Contact not found",
 * "Invalid or expired reset token") never becomes a code.
 */
const MACHINE_CODE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

/** The body's `error` when it has the shape of a machine code, else `null`. */
export function machineCodeOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  return typeof error === 'string' && MACHINE_CODE.test(error) ? error : null;
}

/**
 * The body's item list: `errors` (typify's `TypifyErrorResponse`) or, failing that, `details`
 * (Platform's `ErrorDetailResponse(Error, Details)`, e.g. a password-policy refusal).
 */
function errorItemsOf(body: unknown): readonly ApiErrorItem[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { errors?: unknown; details?: unknown };
  const items = Array.isArray(b.errors) ? b.errors : b.details;
  if (!Array.isArray(items)) return null;
  return items.filter(
    (e): e is ApiErrorItem => typeof e === 'string' || (typeof e === 'object' && e !== null),
  );
}

/** The message the client has always thrown for a refused request (kept for unmigrated callers). */
function legacyMessageOf(body: unknown, status: number): string {
  const b = (typeof body === 'object' && body !== null ? body : {}) as {
    detail?: unknown;
    error?: unknown;
    errors?: unknown;
  };
  const joined = Array.isArray(b.errors)
    ? b.errors
        .map((e: unknown) =>
          typeof e === 'object' && e !== null && 'message' in e
            ? (e as { message?: unknown }).message
            : e,
        )
        .filter(Boolean)
        .join('; ') || undefined
    : undefined;
  const msg = (b.detail as string | undefined) ?? (b.error as string | undefined) ?? joined;
  return msg ?? `API error: ${status}`;
}

export class ApiError extends Error {
  /** The HTTP status Platform answered. */
  readonly status: number;
  /** Platform's machine code (`not-owner`), or `null` when the body carried prose or nothing. */
  readonly code: string | null;
  /** The body's item list when it had one: typify's `errors`, or an `ErrorDetailResponse`'s `details`. */
  readonly errors: readonly ApiErrorItem[] | null;

  constructor(status: number, body: unknown) {
    super(legacyMessageOf(body, status));
    this.name = 'ApiError';
    this.status = status;
    this.code = machineCodeOf(body);
    this.errors = errorItemsOf(body);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** What a refusal is reported as: the code exposed as `data-error-code`, and its translation key. */
export interface ApiErrorEntry {
  readonly code: string;
  /** An i18n key, namespaced when it is not in `common` (`admin:users.changed`). */
  readonly key: string;
}

/**
 * A rule may depend on the refusal itself (for example "a 400 that carries an `errors` list");
 * returning `null` lets the lookup fall through to the next, more general rule.
 */
export type ApiErrorRule = ApiErrorEntry | ((err: ApiError) => ApiErrorEntry | null);

/**
 * A closed map from a refusal to a message. Lookup order, first match wins:
 * 1. `codes[err.code]` — a machine code always wins over an inference from context (ADR-0013);
 * 2. `actions[action][err.status]` — status per action, when the caller names the action;
 * 3. `statuses[err.status]`;
 * 4. `fallback`.
 */
export interface ApiErrorMap<A extends string = string> {
  readonly codes?: Readonly<Record<string, ApiErrorEntry>>;
  readonly actions?: Readonly<Partial<Record<A, Readonly<Partial<Record<number, ApiErrorRule>>>>>>;
  readonly statuses?: Readonly<Partial<Record<number, ApiErrorRule>>>;
  readonly fallback: ApiErrorEntry;
}

function applyRule(rule: ApiErrorRule | undefined, err: ApiError): ApiErrorEntry | null {
  if (rule === undefined) return null;
  return typeof rule === 'function' ? rule(err) : rule;
}

/**
 * The entry a refusal is reported as. Anything that is not an {@link ApiError} (a network failure,
 * an unexpected exception) gets the map's fallback. Own-property lookups only, so a code such as
 * `constructor` never matches.
 */
export function describeApiError<A extends string>(
  err: unknown,
  map: ApiErrorMap<A>,
  action?: A,
): ApiErrorEntry {
  if (!isApiError(err)) return map.fallback;

  if (err.code !== null && map.codes && Object.hasOwn(map.codes, err.code)) {
    const entry = map.codes[err.code];
    if (entry) return entry;
  }

  if (action !== undefined && map.actions && Object.hasOwn(map.actions, action)) {
    const perAction = map.actions[action];
    if (perAction && Object.hasOwn(perAction, err.status)) {
      const entry = applyRule(perAction[err.status], err);
      if (entry) return entry;
    }
  }

  if (map.statuses && Object.hasOwn(map.statuses, err.status)) {
    const entry = applyRule(map.statuses[err.status], err);
    if (entry) return entry;
  }

  return map.fallback;
}

/** Every entry a map can produce, for tests that check each key exists in every locale. */
export function entriesOf(map: ApiErrorMap): ApiErrorEntry[] {
  const out: ApiErrorEntry[] = [map.fallback];
  const push = (rule: ApiErrorRule | undefined) => {
    if (rule !== undefined && typeof rule !== 'function') out.push(rule);
  };
  Object.values(map.codes ?? {}).forEach(push);
  Object.values(map.statuses ?? {}).forEach(push);
  Object.values(map.actions ?? {}).forEach((perAction) =>
    Object.values(perAction ?? {}).forEach(push),
  );
  return out;
}
