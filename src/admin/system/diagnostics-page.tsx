import { Link } from 'react-router';
import { Server, Shield, Cpu, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/core/ui/badge';
import { PageHeader } from '@/core/ui/page-header';
import { PageSkeleton } from '@/core/ui/page-skeleton';
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
  const { t } = useTranslation('admin');
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
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status]}`}
        >
          {t(`system.diagnostics.status.${status}`)}
        </span>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

export default function DiagnosticsPage() {
  const { t } = useTranslation('admin');
  const { data: systemInfo, isLoading: loadingInfo } = useSystemInfo();
  const { data: license, isLoading: loadingLicense } = useSystemLicense();
  const { data: clusterStatus, isLoading: loadingCluster } = useClusterStatus();

  const isLoading = loadingInfo || loadingLicense || loadingCluster;
  const na = t('system.diagnostics.na');

  return (
    <div className="space-y-6">
      <PageHeader title={t('system.diagnostics.title')} />

      {isLoading ? (
        <PageSkeleton variant="form" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Platform Info */}
            <StatusCard
              title={t('system.diagnostics.platform.title')}
              icon={Server}
              status={systemInfo ? 'connected' : 'error'}
              testId="diag-platform-card"
            >
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('system.diagnostics.platform.version')}
                </span>
                <span className="font-mono text-xs">{systemInfo?.version ?? na}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('system.diagnostics.platform.tenant')}
                </span>
                <span>{systemInfo?.hostTenantId ?? na}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('system.diagnostics.platform.setup')}
                </span>
                <Badge variant={systemInfo?.hostTenantId ? 'default' : 'secondary'}>
                  {systemInfo?.hostTenantId
                    ? t('system.diagnostics.platform.complete')
                    : t('system.diagnostics.platform.pending')}
                </Badge>
              </div>
            </StatusCard>

            {/* License */}
            <StatusCard
              title={t('system.diagnostics.license.title')}
              icon={Shield}
              status={license ? 'connected' : 'warning'}
              testId="diag-license-card"
            >
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('system.diagnostics.license.status')}
                </span>
                <Badge variant="outline">{license?.status ?? na}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('system.diagnostics.license.max_nodes')}
                </span>
                <span>{license?.maxNodes ?? na}</span>
              </div>
              {license?.licensedFeatures && license.licensedFeatures.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-muted-foreground">
                    {t('system.diagnostics.license.features')}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {license.licensedFeatures.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </StatusCard>

            {/* Cluster */}
            <StatusCard
              title={t('system.diagnostics.cluster.title')}
              icon={Cpu}
              status={clusterStatus ? 'connected' : 'warning'}
              testId="diag-cluster-card"
            >
              {clusterStatus && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('system.diagnostics.cluster.nodes')}
                    </span>
                    <span>{clusterStatus.nodes?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('system.diagnostics.cluster.total_channels')}
                    </span>
                    <span>{clusterStatus.totalChannels}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('system.diagnostics.cluster.total_agents')}
                    </span>
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
                  {t('system.diagnostics.cluster.manage')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </StatusCard>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t('system.diagnostics.auto_refresh')}
          </p>
        </>
      )}
    </div>
  );
}
