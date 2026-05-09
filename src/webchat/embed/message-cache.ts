import type { ChatMessage } from './transport/session-api';

const KEY = (tenantId: string) => `verbara-webchat-messages:${tenantId}`;
const MAX_CACHED = 100;

export function loadCachedMessages(tenantId: string): ChatMessage[] {
  const raw = localStorage.getItem(KEY(tenantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCachedMessages(tenantId: string, messages: ChatMessage[]): void {
  const trimmed = messages.slice(-MAX_CACHED);
  localStorage.setItem(KEY(tenantId), JSON.stringify(trimmed));
}

export function clearCachedMessages(tenantId: string): void {
  localStorage.removeItem(KEY(tenantId));
}
