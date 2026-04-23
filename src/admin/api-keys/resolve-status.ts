// R5.1 Phase 2 Task Q — API-key status resolution helper.
//
// Extracted from `api-keys-page.tsx` so the page file only exports components
// (satisfies the `react-refresh/only-export-components` rule). The page and
// tests both consume this helper.
//
// StatusBadge variant="api-key" understands `active` / `expired` / `revoked`
// (see `src/core/ui/status-badge.tsx` — API_KEY_MAP). Keeping this mapping
// here rather than pushing it down into the hook lets the backend DTO stay
// as-is (no backend flag for "expired"; computed client-side from expiresAt).

export type ApiKeyStatus = 'active' | 'expired' | 'revoked';

export function resolveApiKeyStatus(
  key: { isRevoked: boolean; expiresAt: string | null },
  now: Date = new Date(),
): ApiKeyStatus {
  if (key.isRevoked) return 'revoked';
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= now.getTime()) {
    return 'expired';
  }
  return 'active';
}
