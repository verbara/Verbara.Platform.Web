import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { useUiStore } from '@/core/stores/ui-store';
import { customFetch } from '@/core/api/client';

interface SetupStatus {
  hasQueues: boolean;
  hasAgents: boolean;
  hasChannel: boolean;
}

export function SetupBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setupDismissed = useUiStore((s) => s.setupDismissed);
  const testCompleted = useUiStore((s) => s.testCompleted);
  const setSetupDismissed = useUiStore((s) => s.setSetupDismissed);

  const { data: status } = useQuery<SetupStatus>({
    queryKey: ['setup-status'],
    queryFn: async () => {
      let hasQueues = false;
      let hasAgents = false;
      let hasChannel = false;

      try {
        const queues = await customFetch<unknown[]>({ url: '/api/admin/queues', method: 'GET' });
        hasQueues = queues.length > 0;
      } catch {
        hasQueues = false;
      }

      try {
        const agents = await customFetch<unknown[]>({ url: '/api/admin/agents', method: 'GET' });
        hasAgents = agents.length > 0;
      } catch {
        hasAgents = false;
      }

      try {
        const channels = await customFetch<{ isActive?: boolean }[]>({
          url: '/api/admin/channels',
          method: 'GET',
        });
        hasChannel = channels.some((c) => c.isActive);
      } catch {
        hasChannel = false;
      }

      return { hasQueues, hasAgents, hasChannel };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (setupDismissed) return null;

  const steps = [
    { key: 'queue', done: status?.hasQueues ?? false },
    { key: 'agent', done: status?.hasAgents ?? false },
    { key: 'channel', done: status?.hasChannel ?? false },
    { key: 'test', done: testCompleted },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  if (completedCount === 4) return null;

  return (
    <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center gap-3">
        <div className="flex w-24 gap-0.5">
          {steps.map((step) => (
            <div
              key={step.key}
              className={`h-2 flex-1 rounded-full ${step.done ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
        <span className="text-sm text-amber-800 dark:text-amber-200">
          {t('setup.bannerIncomplete', {
            completed: completedCount,
            total: 4,
            defaultValue: `Setup incomplete — ${completedCount} of 4 steps done`,
          })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/setup')}>
          {t('setup.resumeSetup', 'Resume setup')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setSetupDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
