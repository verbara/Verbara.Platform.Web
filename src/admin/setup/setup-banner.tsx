import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { useOnboardingStatus, useDismissChecklist } from '@/core/api/hooks/use-onboarding';

export function SetupBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: status } = useOnboardingStatus();
  const dismissChecklist = useDismissChecklist();

  if (!status || status.checklistDismissed) return null;

  const completedCount = status.checklist.filter((item) => item.completed).length;
  const totalCount = status.checklist.length;

  if (completedCount === totalCount) return null;

  return (
    <div data-testid="setup-banner" className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center gap-3">
        <div className="flex w-24 gap-0.5">
          {status.checklist.map((item) => (
            <div
              key={item.key}
              className={`h-2 flex-1 rounded-full ${item.completed ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
        <span className="text-sm text-amber-800 dark:text-amber-200">
          {t('setup.bannerIncomplete', {
            done: completedCount,
            total: totalCount,
            defaultValue: `Setup incomplete — ${completedCount} of ${totalCount} steps done`,
          })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button data-testid="setup-banner-resume" variant="outline" size="sm" onClick={() => navigate('/admin/setup')}>
          {t('setup.bannerResume', 'Resume setup')}
        </Button>
        <Button
          data-testid="setup-banner-dismiss"
          variant="ghost"
          size="sm"
          onClick={() => void dismissChecklist.mutateAsync()}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
