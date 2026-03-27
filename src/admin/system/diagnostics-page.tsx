import { Server, Shield, Cpu } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { useSystemInfo, useSystemLicense, useSystemCluster } from '@/core/api/hooks/use-system';
import { useClusterNodes, useClusterStatus } from '@/core/api/hooks/use-cluster';

interface StatusCardProps {
  title: string;
  icon: typeof Server;
  status: 'connected' | 'error' | 'warning' | 'unknown';
  children: React.ReactNode;
}

function StatusCard({ title, icon: Icon, status, children }: StatusCardProps) {
  const statusColors = {
    connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

export default function DiagnosticsPage() {
  const { data: systemInfo, isLoading: loadingInfo } = useSystemInfo();
  const { data: license, isLoading: loadingLicense } = useSystemLicense();
  const { data: cluster, isLoading: loadingCluster } = useSystemCluster();
  const { data: nodes = [] } = useClusterNodes();
  const { data: clusterStatus } = useClusterStatus();

  const isLoading = loadingInfo || loadingLicense || loadingCluster;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="System Diagnostics" />
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Diagnostics" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Platform Info */}
        <StatusCard
          title="Platform"
          icon={Server}
          status={systemInfo ? 'connected' : 'error'}
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono text-xs">{systemInfo?.version ?? 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tenant</span>
            <span>{systemInfo?.tenantId ?? 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Setup</span>
            <Badge variant={systemInfo?.setupComplete ? 'default' : 'secondary'}>
              {systemInfo?.setupComplete ? 'Complete' : 'Pending'}
            </Badge>
          </div>
        </StatusCard>

        {/* License */}
        <StatusCard
          title="License"
          icon={Shield}
          status={license ? 'connected' : 'warning'}
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tier</span>
            <Badge variant="outline">{license?.tier ?? 'N/A'}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Agents</span>
            <span>{license?.maxAgents ?? 'N/A'}</span>
          </div>
          {license?.features && (
            <div className="mt-1">
              <span className="text-xs text-muted-foreground">Features:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(license.features)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                  ))}
              </div>
            </div>
          )}
        </StatusCard>

        {/* Cluster */}
        <StatusCard
          title="Cluster"
          icon={Cpu}
          status={cluster && cluster.nodes.length > 0 ? 'connected' : 'warning'}
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nodes</span>
            <span>{cluster?.nodes.length ?? 0}</span>
          </div>
          {clusterStatus && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Channels</span>
                <span>{clusterStatus.totalChannels}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Agents</span>
                <span>{clusterStatus.totalAgents}</span>
              </div>
            </>
          )}
        </StatusCard>
      </div>

      {/* Cluster Nodes Detail */}
      {nodes.length > 0 && (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Cluster Nodes
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Node ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">State</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Weight</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Priority</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Max Capacity</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Asterisk</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Started</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => (
                  <tr key={node.nodeId} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{node.nodeId}</td>
                    <td className="px-3 py-2">
                      <Badge variant={node.state === 'active' ? 'default' : 'secondary'}>
                        {node.state}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{node.weight}</td>
                    <td className="px-3 py-2">{node.priorityTier}</td>
                    <td className="px-3 py-2">{node.maxCapacity}</td>
                    <td className="px-3 py-2 font-mono text-xs">{node.asteriskVersion ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {node.startupTime ? new Date(node.startupTime).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Drains */}
      {clusterStatus && clusterStatus.activeDrains.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
          <h3 className="mb-3 text-sm font-semibold text-amber-700 dark:text-amber-400">
            Active Drains
          </h3>
          {clusterStatus.activeDrains.map((drain) => (
            <div key={drain.nodeId} className="flex items-center justify-between py-2 text-sm">
              <span className="font-mono">{drain.nodeId}</span>
              <span>{drain.remainingCallCount} calls remaining</span>
              <Badge variant="outline">{drain.state}</Badge>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Auto-refreshes every 15 seconds
      </p>
    </div>
  );
}
