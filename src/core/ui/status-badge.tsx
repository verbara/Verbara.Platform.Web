import { useTranslation } from 'react-i18next';

import { Badge } from '@/core/ui/badge';
import { cn } from '@/lib/utils';

// ─── Color palette ───────────────────────────────────────────────────────────
// Canonical color tokens mapped to Tailwind class strings. Defined once so the
// variant/status → color indirection stays decoupled from the exact classes.

export type StatusBadgeColor = 'green' | 'amber' | 'red' | 'gray' | 'blue';

const COLOR_CLASSES: Record<StatusBadgeColor, string> = {
  green: 'bg-green-500/20 text-green-700 dark:text-green-400',
  amber: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  red: 'bg-red-500/20 text-red-700 dark:text-red-400',
  gray: 'bg-gray-500/20 text-gray-700 dark:text-gray-400',
  blue: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
};

// Size mapping only carries the 'md' override — the underlying Badge component
// already emits `text-xs px-2 py-0.5` as its baseline, so mapping 'sm' to the
// same classes would be dead weight. An empty string for 'sm' keeps the default.
const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: '',
  md: 'text-sm px-2.5 py-0.5',
};

// ─── Variant → status → color maps ───────────────────────────────────────────
// Each variant is a namespace of canonical status strings. Status lookups are
// case-insensitive (we normalize to lowercase before lookup).

/**
 * Variant namespace the badge pulls its i18n key + color mapping from.
 *
 * Note: the `'generic'` variant intentionally has NO i18n entries — it's an
 * escape hatch for ad-hoc status strings that aren't part of a curated
 * namespace. Labels fall back to the raw status string the caller passes in,
 * and the color always resolves to `gray`. DEV builds log a warning so
 * unexpected generic usage surfaces during integration.
 */
export type StatusBadgeVariant =
  | 'cluster-node'
  | 'license'
  | 'api-key'
  | 'webhook-circuit'
  | 'mfa'
  | 'generic';

type VariantMap = Record<string, StatusBadgeColor>;

const CLUSTER_NODE_MAP: VariantMap = {
  healthy: 'green',
  degraded: 'amber',
  unhealthy: 'red',
  draining: 'blue',
  offline: 'gray',
  unknown: 'gray',
};

const LICENSE_MAP: VariantMap = {
  active: 'green',
  grace: 'amber',
  expired: 'red',
  invalid: 'red',
};

const API_KEY_MAP: VariantMap = {
  active: 'green',
  expired: 'gray',
  revoked: 'red',
};

const WEBHOOK_CIRCUIT_MAP: VariantMap = {
  closed: 'green',
  halfopen: 'amber',
  open: 'red',
};

const MFA_MAP: VariantMap = {
  enrolled: 'green',
  notenrolled: 'gray',
  locked: 'red',
};

const VARIANT_MAPS: Record<Exclude<StatusBadgeVariant, 'generic'>, VariantMap> = {
  'cluster-node': CLUSTER_NODE_MAP,
  license: LICENSE_MAP,
  'api-key': API_KEY_MAP,
  'webhook-circuit': WEBHOOK_CIRCUIT_MAP,
  mfa: MFA_MAP,
};

// Lowercase normalizer that also strips dashes so "Half-Open" or "HalfOpen"
// or "half-open" all collapse to the same lookup key ("halfopen"). This keeps
// the consumer contract forgiving without requiring them to know the exact
// canonical spelling.
function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/-/g, '').replace(/_/g, '');
}

// Builds the i18n key. The status segment is kept lowercase and dash-stripped
// to align with how CLUSTER_NODE_MAP / LICENSE_MAP / etc. are keyed, so the
// JSON locale files only need a single spelling per status.
function buildI18nKey(variant: StatusBadgeVariant, status: string): string {
  return `status.${variant}.${normalizeStatus(status)}`;
}

function resolveColor(
  variant: StatusBadgeVariant,
  status: string
): StatusBadgeColor {
  if (variant === 'generic') {
    if (import.meta.env.DEV) {
      // Development-only warning so consumers catch unknown status strings
      // during integration instead of shipping a silent gray badge.
      console.warn(
        `[StatusBadge] Unknown status "${status}" for variant "generic" — falling back to gray.`
      );
    }
    return 'gray';
  }
  const map = VARIANT_MAPS[variant];
  const key = normalizeStatus(status);
  return map[key] ?? 'gray';
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  readonly status: string;
  readonly variant: StatusBadgeVariant;
  readonly size?: 'sm' | 'md';
}

export function StatusBadge({ status, variant, size = 'sm' }: StatusBadgeProps) {
  const { t } = useTranslation();
  const color = resolveColor(variant, status);
  const i18nKey = buildI18nKey(variant, status);
  const label = t(i18nKey, status);

  return (
    <Badge
      className={cn(COLOR_CLASSES[color], SIZE_CLASSES[size], 'border-transparent')}
    >
      {label}
    </Badge>
  );
}
