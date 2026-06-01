import { useTranslation } from 'react-i18next';
import { TriangleAlert, ShieldAlert, Info } from 'lucide-react';
import { useAgentAiStore, EMPTY_SESSION } from '@/agent/stores/agent-ai-store';
import { Button } from '@/core/ui/button';

const SEVERITY_ICON = {
  Info: Info,
  Warning: TriangleAlert,
  Critical: ShieldAlert,
};

export function ComplianceAlert({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation('agent');
  const complianceAlerts = useAgentAiStore(
    (s) => (s.sessions[conversationId] ?? EMPTY_SESSION).complianceAlerts,
  );
  const acknowledgeAlert = useAgentAiStore((s) => s.acknowledgeAlert);

  if (complianceAlerts.length === 0) return null;

  const criticalAlerts = complianceAlerts.filter((a) => a.severity === 'Critical');
  const warningAlerts = complianceAlerts.filter((a) => a.severity === 'Warning');
  const infoAlerts = complianceAlerts.filter((a) => a.severity === 'Info');

  return (
    <div className="flex flex-col gap-1 px-4 pt-2">
      {/* Badge counter */}
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
          {complianceAlerts.length}
        </span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          compliance {complianceAlerts.length === 1 ? 'alert' : 'alerts'}
        </span>
      </div>

      {/* Critical alerts */}
      {criticalAlerts.map((alert) => {
        const Icon = SEVERITY_ICON['Critical'];
        return (
          <div
            key={alert.ruleId}
            className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 dark:border-red-700 dark:bg-red-950/30"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800 dark:text-red-300">{alert.ruleId}</p>
              {alert.phrase && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  &ldquo;{alert.phrase}&rdquo;
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => acknowledgeAlert(conversationId, alert.ruleId)}
              className="shrink-0 text-xs"
            >
              {t('ai.acknowledge')}
            </Button>
          </div>
        );
      })}

      {/* Warning alerts */}
      {warningAlerts.map((alert) => {
        const Icon = SEVERITY_ICON['Warning'];
        return (
          <div
            key={alert.ruleId}
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/30"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {alert.ruleId}
              </p>
              {alert.phrase && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  &ldquo;{alert.phrase}&rdquo;
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Info alerts */}
      {infoAlerts.map((alert) => {
        const Icon = SEVERITY_ICON['Info'];
        return (
          <div
            key={alert.ruleId}
            className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-700 dark:bg-blue-950/30"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
            <div className="flex-1">
              <p className="text-sm text-blue-700 dark:text-blue-300">{alert.ruleId}</p>
              {alert.phrase && (
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  &ldquo;{alert.phrase}&rdquo;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
