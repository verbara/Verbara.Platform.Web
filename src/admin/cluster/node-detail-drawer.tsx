// NodeDetailDrawer — read-only inspection panel for a single cluster node,
// surfaced by row-click on the cluster page table.
//
// Three tabs:
//   - Overview: node meta (id, state, capacity/weight/tier, asterisk version,
//               startup time, AMI endpoint) + Grafana deeplink when wired.
//   - Drain Status: active-drain progress snapshot, or "not draining".
//   - History: compact AuditTrailMini (last 10 audit events).
//
// The drawer is purely informational — node mutations (add/edit/drain/remove)
// remain on the parent page via the existing row-action dropdown. This avoids
// widening test surface on a shipped flow while still materialising the new
// incremental value (deep inspection + ops deeplink + audit trail).

import { Activity, ExternalLink, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AuditTrailMini } from '@/admin/shared/audit-trail-mini';
import { Badge } from '@/core/ui/badge';
import { DrawerDetail } from '@/core/ui/drawer-detail';
import { StatCard } from '@/core/ui/stat-card';
import { StatusBadge } from '@/core/ui/status-badge';
import type {
  ClusterNode,
  DrainStatus,
} from '@/core/api/hooks/use-cluster';

export interface NodeDetailDrawerProps {
  readonly node: ClusterNode | undefined;
  readonly activeDrain?: DrainStatus;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGrafanaUrl(): string | undefined {
  // Read via `import.meta.env` and narrow to `string | undefined`. Vite inlines
  // these at build time; unset keys resolve to `undefined`, so the deeplink
  // card below simply doesn't render when the operator hasn't wired one.
  const raw = (import.meta.env.VITE_GRAFANA_URL as string | undefined) ?? undefined;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildGrafanaDeeplink(baseUrl: string, nodeId: string): string {
  // Convention: VITE_GRAFANA_URL may point at either the Grafana root
  // (e.g. "https://grafana.example.com") or at a pre-canned dashboard path
  // (e.g. ".../d/asterisk-cluster/overview"). In both cases we append the
  // node filter as a query param — Grafana ignores unknown `var-*` params on
  // dashboards that don't declare them, so this is safe by default.
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}var-node=${encodeURIComponent(nodeId)}`;
}

function formatIso(iso: string | undefined): string {
  if (iso === undefined || iso === null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({ node }: { node: ClusterNode }) {
  const { t } = useTranslation(['admin', 'common']);
  const grafanaBase = getGrafanaUrl();
  const grafanaHref = grafanaBase ? buildGrafanaDeeplink(grafanaBase, node.nodeId) : undefined;

  return (
    <div className="space-y-4" data-testid="cluster-node-detail-overview">
      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border bg-card p-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.node-id')}</p>
          <p className="font-mono text-sm">{node.nodeId}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.state')}</p>
          <StatusBadge variant="cluster-node" status={node.state} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('admin:cluster-nodes.detail.asterisk-version')}
          </p>
          <p className="font-mono text-sm">{node.asteriskVersion ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.startup-time')}</p>
          <p className="text-sm">{formatIso(node.startupTime)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.ami-endpoint')}</p>
          <p className="font-mono text-sm">
            {node.amiHostname ? `${node.amiHostname}:${node.amiPort ?? '—'}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('admin:cluster-nodes.detail.priority-tier')}
          </p>
          <p className="text-sm">{node.priorityTier}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Server className="h-4 w-4" />}
          label={t('admin:cluster-nodes.detail.max-capacity')}
          value={node.maxCapacity}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label={t('admin:cluster-nodes.detail.weight')}
          value={node.weight}
        />
      </div>

      {/* Grafana deeplink — only when VITE_GRAFANA_URL is wired. */}
      {grafanaHref && (
        <a
          href={grafanaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-lg"
          data-testid="cluster-node-grafana-link"
        >
          <StatCard
            icon={<ExternalLink className="h-4 w-4" />}
            label={t('admin:cluster-nodes.detail.grafana-dashboard', 'Open in Grafana')}
            value={
              <span className="text-sm font-medium text-primary">
                {t('admin:cluster-nodes.detail.grafana-dashboard', 'Open in Grafana')}
              </span>
            }
            description={`${grafanaHref}`}
          />
        </a>
      )}
    </div>
  );
}

// ─── Drain tab ───────────────────────────────────────────────────────────────

function DrainTab({
  node,
  activeDrain,
}: {
  node: ClusterNode;
  activeDrain: DrainStatus | undefined;
}) {
  const { t } = useTranslation(['admin']);

  if (node.state !== 'Draining' || !activeDrain) {
    return (
      <div
        className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground"
        data-testid="cluster-node-detail-drain-empty"
      >
        {t('admin:cluster-nodes.detail.not-draining', 'This node is not currently draining.')}
      </div>
    );
  }

  const initial = Math.max(1, activeDrain.initialCallCount);
  const completed = activeDrain.naturallyCompleted + activeDrain.forceDisconnected;
  const percent = Math.min(100, Math.round((completed / initial) * 100));

  return (
    <div className="space-y-4" data-testid="cluster-node-detail-drain">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t('admin:cluster-nodes.detail.active-sessions', 'Active sessions')}:{' '}
            <span className="font-medium text-foreground">{activeDrain.remainingCallCount}</span>
          </span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            data-testid="cluster-node-detail-drain-bar"
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.deadline')}</p>
          <p>{formatIso(activeDrain.deadline)}</p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.started')}</p>
          <p>{formatIso(activeDrain.startedAt)}</p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.completed')}</p>
          <p>
            {activeDrain.naturallyCompleted}{' '}
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {t('admin:cluster-nodes.detail.natural-badge')}
            </Badge>
          </p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('admin:cluster-nodes.detail.force-disconnected')}</p>
          <p>{activeDrain.forceDisconnected}</p>
        </div>
      </div>
    </div>
  );
}

// ─── History tab ─────────────────────────────────────────────────────────────

function HistoryTab({ nodeId }: { nodeId: string }) {
  return <AuditTrailMini resourceType="cluster_node" resourceId={nodeId} />;
}

// ─── Drawer root ─────────────────────────────────────────────────────────────

export function NodeDetailDrawer({
  node,
  activeDrain,
  open,
  onOpenChange,
}: NodeDetailDrawerProps) {
  const { t } = useTranslation(['admin']);

  // `node` is undefined between mount and selection. Keep the drawer closed
  // until we have content — the parent owns `open` but we defensively guard
  // so the tabbed content can assume a non-null node in each tab renderer.
  if (!node) return null;

  return (
    <DrawerDetail
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono">{node.nodeId}</span>
          <StatusBadge variant="cluster-node" status={node.state} />
        </span>
      }
      subtitle={node.asteriskVersion ? `Asterisk ${node.asteriskVersion}` : undefined}
      width="lg"
      tabs={[
        {
          key: 'overview',
          label: t('admin:cluster-nodes.detail.overview', 'Overview'),
          content: <OverviewTab node={node} />,
        },
        {
          key: 'drain',
          label: t('admin:cluster-nodes.detail.drain-status', 'Drain Status'),
          content: <DrainTab node={node} activeDrain={activeDrain} />,
        },
        {
          key: 'history',
          label: t('admin:cluster-nodes.detail.history', 'History'),
          content: <HistoryTab nodeId={node.nodeId} />,
        },
      ]}
    />
  );
}
