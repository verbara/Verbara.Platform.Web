// Thin alias over `useEntityHistory` for semantic clarity at call-sites that
// think of the dataset as "audit events for a resource" rather than "history
// for an entity". The underlying hook (use-audit.ts:useEntityHistory) already
// covers the `GET /api/v1/admin/audit/{entityType}/{entityId}` contract, so
// this wrapper exists purely as a naming bridge — no duplicate query keys,
// no duplicate cache entries.

import { useEntityHistory, type AuditEntry } from '@/core/api/hooks/use-audit';

export interface UseAuditEventsArgs {
  /** e.g. `cluster_node`, `queue`, `campaign`. Passed verbatim to the API. */
  readonly resourceType: string | undefined;
  /** Primary key of the resource — usually the identity column from its table. */
  readonly resourceId: string | undefined;
}

export function useAuditEvents({ resourceType, resourceId }: UseAuditEventsArgs) {
  return useEntityHistory(resourceType, resourceId);
}

export type { AuditEntry };
