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
    throw new Error(`createSession failed with ${res.status}`);
  }
  const data = (await res.json()) as CreateSessionResult;
  return data;
}

export async function fetchHistory(input: {
  apiBase: string;
  sessionId: string;
}): Promise<ChatMessage[]> {
  const url = `${input.apiBase.replace(/\/$/, '')}/webchat/sessions/${encodeURIComponent(input.sessionId)}/messages`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`fetchHistory failed with ${res.status}`);
  const data = (await res.json()) as ChatMessage[];
  return Array.isArray(data) ? data : [];
}
