import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, FormProvider } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Check, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/admin/shared/page-header';
import { useUiStore } from '@/core/stores/ui-store';
import { customFetch } from '@/core/api/client';
import { useCompleteOnboarding } from '@/core/api/hooks/use-onboarding';
import { useCreateQueue } from '@/core/api/hooks/use-queues';
import { useCreateAgent } from '@/core/api/hooks/use-agents';
import WelcomeStep from './steps/welcome-step';
import QueueStep from './steps/queue-step';
import AgentStep from './steps/agent-step';
import ChannelStep from './steps/channel-step';
import TestStep from './steps/test-step';

const STEP_KEYS = ['welcome', 'queue', 'agent', 'channel', 'test'] as const;
type StepKey = (typeof STEP_KEYS)[number];

export interface SetupFormValues {
  queueName: string;
  agentUserId: string;
  agentDisplayName: string;
  agentEmail: string;
  channelId: string;
  channelConfig: Record<string, string>;
}

const DEFAULT_VALUES: SetupFormValues = {
  queueName: '',
  agentUserId: '',
  agentDisplayName: '',
  agentEmail: '',
  channelId: '',
  channelConfig: {},
};

const STEP_COMPONENTS: Record<StepKey, React.ComponentType> = {
  welcome: WelcomeStep,
  queue: QueueStep,
  agent: AgentStep,
  channel: ChannelStep,
  test: TestStep,
};

export default function SetupWizard() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const methods = useForm<SetupFormValues>({
    defaultValues: DEFAULT_VALUES,
  });
  const [loading, setLoading] = useState(false);
  const completeOnboarding = useCompleteOnboarding();
  const createQueue = useCreateQueue();
  const createAgent = useCreateAgent();

  const currentStepKey = STEP_KEYS[step] as StepKey;
  const StepComponent = STEP_COMPONENTS[currentStepKey];
  const isFirst = step === 0;
  const isLast = step === STEP_KEYS.length - 1;
  const isWelcome = currentStepKey === 'welcome';

  const handleSkip = () => {
    useUiStore.getState().setSetupDismissed(true);
    navigate('/admin');
  };

  const handleNext = async () => {
    const values = methods.getValues();
    setLoading(true);

    try {
      if (currentStepKey === 'queue') {
        try {
          await createQueue.mutateAsync({ name: values.queueName, isActive: true });
        } catch {
          return;
        }
      }

      if (currentStepKey === 'agent') {
        try {
          let userId = values.agentUserId;
          if (!userId && values.agentEmail) {
            const user = await customFetch<{ id: string }>({
              url: '/api/v1/admin/users',
              method: 'POST',
              data: {
                email: values.agentEmail,
                displayName: values.agentDisplayName,
                role: 'agent',
              },
            });
            userId = user.id;
          }
          await createAgent.mutateAsync({ userId, displayName: values.agentDisplayName });
        } catch {
          return;
        }
      }

      if (currentStepKey === 'channel') {
        try {
          await customFetch({
            url: `/api/v1/admin/channels/${values.channelId}`,
            method: 'PUT',
            data: { isActive: true, credentials: values.channelConfig },
          });
          toast.success(t('toasts.setup.channelEnabled'));
        } catch {
          toast.error(t('toasts.setup.channelEnableFailed'));
          return;
        }
      }

      setStep((s) => s + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    try {
      await completeOnboarding.mutateAsync();
    } catch {
      // best-effort — don't block wizard completion
    }
    useUiStore.getState().setTestCompleted(true);
    toast.success(t('toasts.setup.setupComplete'));
    navigate('/admin');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin:setup.wizardTitle', 'Setup Wizard')}
        description={t(
          'admin:setup.wizardDescription',
          'Configure the essentials to get started.',
        )}
      />

      {/* Step indicator */}
      <nav className="flex gap-1">
        {STEP_KEYS.map((key, idx) => (
          <button
            key={key}
            type="button"
            onClick={() => setStep(idx)}
            className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors ${
              idx === step
                ? 'bg-primary text-primary-foreground'
                : idx < step
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {t(`admin:setup.step_${key}`, key)}
          </button>
        ))}
      </nav>

      {/* Step content */}
      <FormProvider {...methods}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <StepComponent />

          {/* Navigation buttons */}
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              {!isFirst && (
                <Button data-testid="setup-back" variant="outline" disabled={loading} onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  {t('admin:setup.previous', 'Back')}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="setup-skip"
                onClick={handleSkip}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t('admin:setup.skip', "Skip, I'll configure later")}
              </button>

              {isWelcome ? (
                <Button data-testid="setup-getstarted" onClick={() => setStep(1)}>
                  <Rocket className="mr-1.5 h-4 w-4" />
                  {t('admin:setup.getStarted', "Let's get started")}
                </Button>
              ) : isLast ? (
                <Button data-testid="setup-finish" disabled={loading} onClick={() => void handleFinish()}>
                  <Check className="mr-1.5 h-4 w-4" />
                  {t('admin:setup.finish', 'Finish Setup')}
                </Button>
              ) : (
                <Button data-testid="setup-next" disabled={loading} onClick={handleNext}>
                  {t('admin:setup.next', 'Next')}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
