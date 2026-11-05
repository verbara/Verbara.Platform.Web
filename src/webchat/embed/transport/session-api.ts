export interface PageContext {
  url: string;
  title: string;
  referrer: string;
}

export interface CreateSessionInput {
  apiBase: string;
  tenantId: string;
  visitorId: string;
  profile: { name?: string; email?: string };
  pageContext: PageContext;
  /** The token the site signed. Only a non-blank string reaches the request. */
  identityToken?: string | null;
}

/** How far Platform knows the contact. It alone decides this: the widget infers nothing from the token. */
export type IdentityLevel = 'Verified' | 'Unverified' | 'Anonymous';

export type IdentityTokenRefusal =
  | 'identity-token-not-configured'
  | 'identity-token-malformed'
  | 'identity-token-signature-invalid'
  | 'identity-token-wrong-tenant'
  | 'identity-token-lifetime-too-long'
  | 'identity-token-not-yet-valid'
  | 'identity-token-expired';

export interface CreateSessionResult {
  sessionId: string;
  wsUrl: string;
  identityLevel: IdentityLevel;
  /** Why a token that was sent was not honoured. The session opens all the same. */
  identityTokenRefusal?: IdentityTokenRefusal;
}

export interface ChatMessage {
  id: string;
  text: string;
  from: 'agent' | 'visitor' | 'system';
  timestamp: string;
  attachments?: Array<{ url: string; name: string; mimeType: string }>;
}

export async function createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const url = `${input.apiBase.replace(/\/$/, '')}/webchat/sessions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: input.tenantId,
      visitorId: input.visitorId,
      visitorName: input.profile.name,
      visitorEmail: input.profile.email,
      pageContext: input.pageContext,
      ...(input.identityToken?.trim() ? { identityToken: input.identityToken } : {}),
    }),
  });
  if (!res.ok) {
    throw new CreateSessionError(res.status, retryAfterMs(res.headers.get('Retry-After')));
  }
  const data = (await res.json()) as CreateSessionResult;
  return data;
}

/** A refused session create. Platform answers 429 with `Retry-After` when the tenant+address limit is spent. */
export class CreateSessionError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | undefined,
  ) {
    super(`createSession failed with ${status}`);
    this.name = 'CreateSessionError';
  }
}

/**
 * Platform answers 404 when the tenant has no active WebChat channel (or does not exist). That does not change
 * within a page load, so the widget stops trying instead of retrying.
 */
export function isChatUnavailable(err: unknown): boolean {
  return err instanceof CreateSessionError && err.status === 404;
}

/** `Retry-After` in seconds (the form Platform sends), as milliseconds. */
function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}
