/**
 * Resolve the current agent's AgentId from the cached /agents/me payload.
 * GET /agents/me serializes the raw Agent domain object as `agentId` (it does
 * NOT follow the `id` DTO convention the other agent hooks normalize to), so
 * accept either key — otherwise currentAgentId() is undefined and every
 * agent-targeted SSE event (incl. the WebChat offer card) is dropped.
 */
export function resolveAgentId(
  cached: { id?: string; agentId?: string } | undefined,
): string | undefined {
  return cached?.agentId ?? cached?.id;
}
