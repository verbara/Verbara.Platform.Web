import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, FormProvider } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Save, Rocket } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/admin/shared/page-header';
import BasicStep from './steps/basic-step';
import DialingStep from './steps/dialing-step';
import ScheduleStep from './steps/schedule-step';
import ComplianceStep from './steps/compliance-step';
import ContactsStep from './steps/contacts-step';

const STEP_KEYS = ['basic', 'dialing', 'schedule', 'compliance', 'contacts'] as const;
type StepKey = (typeof STEP_KEYS)[number];

export type DialingMode = 'preview' | 'progressive' | 'predictive' | 'power' | 'agentless';
export type PacingStrategy = 'fixed' | 'adaptive' | 'timeBased';

export interface ScheduleDay {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

export interface CampaignFormValues {
  // Basic
  name: string;
  description: string;
  queueId: string;
  teamId: string;
  // Dialing
  mode: DialingMode;
  pacingStrategy: PacingStrategy;
  pacingRatio: number;
  pacingTargetWait: number;
  maxChannels: number;
  // Schedule
  schedule: ScheduleDay[];
  timezone: string;
  holidays: string[];
  campaignStart: string;
  campaignEnd: string;
  // Compliance
  dncEnabled: boolean;
  maxAttempts: number;
  retryIntervalMinutes: number;
  timeBetweenAttempts: number;
  complianceNotes: string;
  // Contacts
  contactFile: string;
  columnMapping: Record<string, string>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_VALUES: CampaignFormValues = {
  name: '',
  description: '',
  queueId: '',
  teamId: '',
  mode: 'preview',
  pacingStrategy: 'fixed',
  pacingRatio: 2,
  pacingTargetWait: 15,
  maxChannels: 10,
  schedule: DAYS.map((day) => ({
    day,
    enabled: !['Saturday', 'Sunday'].includes(day),
    start: '09:00',
    end: '18:00',
  })),
  timezone: 'America/New_York',
  holidays: [],
  campaignStart: '',
  campaignEnd: '',
  dncEnabled: true,
  maxAttempts: 3,
  retryIntervalMinutes: 60,
  timeBetweenAttempts: 30,
  complianceNotes: '',
  contactFile: '',
  columnMapping: {},
};

const STEP_COMPONENTS: Record<StepKey, React.ComponentType> = {
  basic: BasicStep,
  dialing: DialingStep,
  schedule: ScheduleStep,
  compliance: ComplianceStep,
  contacts: ContactsStep,
};

export default function CampaignWizard() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const methods = useForm<CampaignFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const currentStepKey = STEP_KEYS[step] as StepKey;
  const StepComponent = STEP_COMPONENTS[currentStepKey];
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
          <StepComponent />

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
