import { clearCachedMessages } from './message-cache';
import { clearStoredSession } from './transport/session-store';
import { clearTenantQueues } from './transport/offline-queue';
import {
  FORGET_VISITOR,
  VISITOR_FORGOTTEN,
  type ForgetVisitorPayload,
} from '@/webchat/sdk/forget-visitor';

export { FORGET_VISITOR, VISITOR_FORGOTTEN };

/** The tenant id of a `forget-visitor` request, or null when the payload is not one. */
export function readForgetVisitor(payload: unknown): ForgetVisitorPayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const tenantId = (payload as Record<string, unknown>)['tenantId'];
  return typeof tenantId === 'string' && tenantId.length > 0 ? { tenantId } : null;
}

/**
 * Clears the conversation the widget kept in this frame's storage for the tenant: the cached messages and the
 * messages waiting to be sent of every visitor, and the stored session. The host page's `destroy()` asks for it.
 */
export function forgetVisitorData(tenantId: string): void {
  clearCachedMessages(tenantId);
  clearStoredSession(tenantId);
  clearTenantQueues(tenantId);
}
