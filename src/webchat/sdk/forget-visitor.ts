import type { BridgeHandle } from './postmessage-bridge';

/**
 * The bridge exchange `destroy()` uses to clear the conversation the widget kept in its frame's storage, which the
 * host page cannot reach when the frame is on another origin. The host posts {@link FORGET_VISITOR}; the frame clears
 * the tenant's entries and answers {@link VISITOR_FORGOTTEN} with the same tenant id.
 */
export const FORGET_VISITOR = 'forget-visitor';
export const VISITOR_FORGOTTEN = 'visitor-forgotten';

/** How long `destroy()` waits for the frame's answer before it removes the frame anyway. */
export const FORGET_TIMEOUT_MS = 2_000;
/** A frame still loading drops a message posted before it listens, so the request is repeated at this interval. */
export const FORGET_RETRY_MS = 100;

export interface ForgetVisitorPayload {
  tenantId: string;
}

export interface ForgetVisitorOptions {
  timeoutMs?: number;
  retryMs?: number;
}

/** Asks the frame to forget the tenant's visitor; resolves true when it answered, false when the wait ran out. */
export function requestForgetVisitor(
  bridge: BridgeHandle,
  payload: ForgetVisitorPayload,
  options: ForgetVisitorOptions = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? FORGET_TIMEOUT_MS;
  const retryMs = options.retryMs ?? FORGET_RETRY_MS;
  return new Promise((resolve) => {
    let retry: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function finish(answered: boolean) {
      if (retry !== null) clearInterval(retry);
      if (timeout !== null) clearTimeout(timeout);
      bridge.off(VISITOR_FORGOTTEN, onAnswer);
      resolve(answered);
    }

    function onAnswer(answer?: unknown) {
      const tenantId =
        typeof answer === 'object' && answer !== null
          ? (answer as Record<string, unknown>)['tenantId']
          : undefined;
      if (tenantId === payload.tenantId) finish(true);
    }

    bridge.on(VISITOR_FORGOTTEN, onAnswer);
    bridge.send(FORGET_VISITOR, payload);
    retry = setInterval(() => bridge.send(FORGET_VISITOR, payload), retryMs);
    timeout = setTimeout(() => finish(false), timeoutMs);
  });
}
