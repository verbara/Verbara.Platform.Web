/**
 * Which signed-in customer the browser last saw for a tenant, kept only to tell when the customer changes. The payload
 * of the site's token is read for that alone: it is never verified, shown or sent, and no level is derived from it.
 * Only Platform decides the level. What is stored is an HMAC of the customer's id, keyed with random bytes of this
 * browser and tenant, so the id is not in clear and the value differs in every browser.
 */

const SUBJECT_KEY = (tenantId: string) => `verbara-webchat-subject:${tenantId}`;
const SECRET_KEY = (tenantId: string) => `verbara-webchat-subject-key:${tenantId}`;
const KEY_BYTES = 32;

export const subjectRecordKey = SUBJECT_KEY;
export const subjectKeyStorageKey = SECRET_KEY;

export function readSubjectRecord(tenantId: string): string | null {
  return localStorage.getItem(SUBJECT_KEY(tenantId));
}

export function writeSubjectRecord(tenantId: string, subject: string | null): void {
  if (subject === null) localStorage.removeItem(SUBJECT_KEY(tenantId));
  else localStorage.setItem(SUBJECT_KEY(tenantId), subject);
}

/** The digest needs a secure context: on a plain `http` page the browser has no `crypto.subtle`. */
export function canRecordSubject(): boolean {
  return Boolean(globalThis.crypto?.subtle);
}

/** The `external_id` of a token's payload, or null for a token whose payload does not give one. */
export function readExternalId(token: string): string | null {
  const payload = token.split('.');
  if (payload.length < 3) return null;
  try {
    const binary = atob(payload[1]!.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const id = (claims as { external_id?: unknown } | null)?.external_id;
    return typeof id === 'string' && id.trim() !== '' ? id.trim() : null;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function browserKey(tenantId: string): Uint8Array<ArrayBuffer> {
  const stored = localStorage.getItem(SECRET_KEY(tenantId));
  if (stored) return fromBase64Url(stored);
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  localStorage.setItem(SECRET_KEY(tenantId), toBase64Url(bytes));
  return bytes;
}

/** Base64url HMAC-SHA256 of the customer's id, keyed for this browser and tenant. */
export async function subjectMac(tenantId: string, externalId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    browserKey(tenantId),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(externalId));
  return toBase64Url(new Uint8Array(mac));
}

/** What the site's call said about the token. */
export type TokenStatement =
  | { kind: 'omitted' }
  | { kind: 'signed-out' }
  | { kind: 'unreadable' }
  | { kind: 'subject'; subject: string };

export type IdentityCall = 'init' | 'setVisitor';

export interface ForgetDecision {
  forget: boolean;
  /** What the record holds afterwards. */
  record: string | null;
  warning: 'omitted' | 'unreadable' | undefined;
}

/**
 * The table of what the browser keeps: the record against the statement. It says nothing about what another tab of the
 * browser still shows, which each widget settles for itself by its own subject.
 */
export function decideForget(
  recorded: string | null,
  statement: TokenStatement,
  hasPriorState: boolean,
  call: IdentityCall,
): ForgetDecision {
  const keep = { forget: false, record: recorded, warning: undefined };
  if (statement.kind === 'subject') {
    if (recorded === statement.subject) return keep;
    const forget = recorded !== null || hasPriorState;
    return { forget, record: statement.subject, warning: undefined };
  }
  if (recorded === null) return keep;
  if (statement.kind === 'signed-out') return { forget: true, record: null, warning: undefined };
  if (statement.kind === 'unreadable') return { forget: true, record: null, warning: 'unreadable' };
  return call === 'init' ? { forget: true, record: null, warning: 'omitted' } : keep;
}
