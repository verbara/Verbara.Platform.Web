import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, FormProvider } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Save, Rocket } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/admin/shared/page-header';

const STEP_KEYS = ['basic', 'dialing', 'schedule', 'compliance', 'contacts'] as const;
type StepKey = (typeof STEP_KEYS)[number];

export interface CampaignFormValues {
  name: string;
  queueName: string;
  mode: string;
  // Dialing step
  maxChannels: number;
  // Schedule step
  startTime: string;
  endTime: string;
  // Compliance step
  dncEnabled: boolean;
  // Contacts step
  contactListId: string;
}

const DEFAULT_VALUES: CampaignFormValues = {
  name: '',
  queueName: '',
  mode: 'preview',
  maxChannels: 10,
  startTime: '09:00',
  endTime: '18:00',
  dncEnabled: true,
  contactListId: '',
};

function StepPlaceholder({ stepKey }: { stepKey: StepKey }) {
  const { t } = useTranslation(['admin']);
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-muted-foreground/25">
      <p className="text-sm text-muted-foreground">
        {t(`admin:campaigns.step_${stepKey}`)} — {t('admin:campaigns.comingSoon')}
      </p>
    </div>
  );
}

export default function CampaignWizard() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const methods = useForm<CampaignFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const currentStepKey = STEP_KEYS[step] as StepKey;
  const isFirst = step === 0;
  const isLast = step === STEP_KEYS.length - 1;

  const handleSaveDraft = () => {
    // TODO: persist draft
    navigate('/admin/campaigns');
  };

  const handleLaunch = () => {
    // TODO: validate all steps + launch
    navigate('/admin/campaigns');
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:campaigns.wizardTitle')} />

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
            {t(`admin:campaigns.step_${key}`)}
          </button>
        ))}
      </nav>

      {/* Step content */}
      <FormProvider {...methods}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <StepPlaceholder stepKey={currentStepKey} />

          {/* Navigation buttons */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              disabled={isFirst}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {t('admin:campaigns.previous')}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveDraft}>
                <Save className="mr-1.5 h-4 w-4" />
                {t('admin:campaigns.saveDraft')}
              </Button>

              {isLast ? (
                <Button onClick={handleLaunch}>
                  <Rocket className="mr-1.5 h-4 w-4" />
                  {t('admin:campaigns.launch')}
                </Button>
              ) : (
                <Button onClick={() => setStep((s) => s + 1)}>
                  {t('admin:campaigns.next')}
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
