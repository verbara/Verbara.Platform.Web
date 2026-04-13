import { Link } from 'react-router-dom';
import { Server, Shield, Cpu, ArrowRight } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/admin/shared/page-header';
import { useSystemInfo, useSystemLicense } from '@/core/api/hooks/use-system';
import { useClusterStatus } from '@/core/api/hooks/use-cluster';

interface StatusCardProps {
  readonly title: string;
  readonly icon: typeof Server;
  readonly status: 'connected' | 'error' | 'warning' | 'unknown';
  readonly children: React.ReactNode;
  readonly testId?: string;
}

function StatusCard({ title, icon: Icon, status, children, testId }: StatusCardProps) {
  const statusColors = {
    connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
  };

  return (
    <div data-testid={testId} className="rounded-lg border bg-card p-5">
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
  const { data: clusterStatus, isLoading: loadingCluster } = useClusterStatus();

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
          testId="diag-platform-card"
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono text-xs">{systemInfo?.version ?? 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tenant</span>
            <span>{systemInfo?.hostTenantId ?? 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Setup</span>
            <Badge variant={systemInfo?.hostTenantId ? 'default' : 'secondary'}>
              {systemInfo?.hostTenantId ? 'Complete' : 'Pending'}
            </Badge>
          </div>
        </StatusCard>

        {/* License */}
        <StatusCard
          title="License"
          icon={Shield}
          status={license ? 'connected' : 'warning'}
          testId="diag-license-card"
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline">{license?.status ?? 'N/A'}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Nodes</span>
            <span>{license?.maxNodes ?? 'N/A'}</span>
          </div>
          {license?.licensedFeatures && license.licensedFeatures.length > 0 && (
            <div className="mt-1">
              <span className="text-xs text-muted-foreground">Features:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {license.licensedFeatures.map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
              </div>
            </div>
          )}
        </StatusCard>

        {/* Cluster */}
        <StatusCard
          title="Cluster"
          icon={Cpu}
          status={clusterStatus ? 'connected' : 'warning'}
          testId="diag-cluster-card"
        >
          {clusterStatus && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nodes</span>
                <span>{clusterStatus.nodes?.length ?? 0}</span>
              </div>
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
          <div className="mt-2">
            <Link
              to="/admin/cluster"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              data-testid="diag-manage-cluster-link"
            >
              Manage cluster
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </StatusCard>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Auto-refreshes every 10 seconds
      </p>
    </div>
  );
}
