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
}

export interface CreateSessionResult {
  sessionId: string;
  wsUrl: string;
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

/** `Retry-After` in seconds (the form Platform sends), as milliseconds. */
function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}
