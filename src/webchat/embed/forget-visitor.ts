import { clearCachedMessages, clearVisitorMessages } from './message-cache';
import { clearStoredSession, clearVisitorSession } from './transport/session-store';
import { clearTenantQueues, clearVisitorQueue } from './transport/offline-queue';
import {
  FORGET_VISITOR,
  VISITOR_FORGOTTEN,
  type ForgetVisitorPayload,
} from '@/webchat/sdk/forget-visitor';

export { FORGET_VISITOR, VISITOR_FORGOTTEN };

/** The tenant id, and the visitor id when it names one, of a `forget-visitor` request; null when it is not one. */
export function readForgetVisitor(payload: unknown): ForgetVisitorPayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const tenantId = (payload as Record<string, unknown>)['tenantId'];
  if (typeof tenantId !== 'string' || tenantId.length === 0) return null;
  const visitorId = (payload as Record<string, unknown>)['visitorId'];
  return typeof visitorId === 'string' && visitorId.length > 0
    ? { tenantId, visitorId }
    : { tenantId };
}

/**
 * Clears the conversation the widget kept in this frame's storage for the tenant: the cached messages and the
 * messages waiting to be sent of every visitor, and the stored session. The host page's `destroy()` asks for it.
 *
 * With `visitorId`, only what that visitor owns: a tab that ends its own widget asks for this, because another tab may
 * already run the next visitor on this same storage.
 */
export function forgetVisitorData(tenantId: string, visitorId?: string): void {
  if (visitorId !== undefined) {
    clearVisitorMessages(tenantId, visitorId);
    clearVisitorSession(tenantId, visitorId);
    clearVisitorQueue(tenantId, visitorId);
    return;
  }
  clearCachedMessages(tenantId);
  clearStoredSession(tenantId);
  clearTenantQueues(tenantId);
}
