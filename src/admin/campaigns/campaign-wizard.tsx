import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useForm, FormProvider } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Save, Rocket } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/core/ui/page-header';
import {
  useCreateCampaign,
  useStartCampaign,
  useCreateContactList,
  useImportContacts,
} from '@/core/api/hooks/use-campaigns';
import {
  STEP_FIELDS,
  STEP_KEYS,
  buildCreateCampaignBody,
  campaignFormSchema,
  firstStepWithError,
  type CampaignFormValues,
  type StepKey,
} from './campaign-form';
import BasicStep from './steps/basic-step';
import DialingStep from './steps/dialing-step';
import ScheduleStep from './steps/schedule-step';
import ComplianceStep from './steps/compliance-step';
import ContactsStep from './steps/contacts-step';

// The form's types, schema, step fields and body builder live in `campaign-form.ts`, so this module
// exports the component only (react-refresh/only-export-components). The steps import the types
// from here.
export type { CampaignFormValues, DialingMode, PacingStrategy, ScheduleDay } from './campaign-form';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_VALUES: CampaignFormValues = {
  name: '',
  description: '',
  targetQueueName: '',
  teamId: '',
  mode: 'preview',
  pacingStrategy: 'fixed',
  pacingRatio: 2,
  pacingTargetWait: 15,
  maxChannels: 10,
  callerIdPoolId: null,
  useGlobalDefaults: true,
  schedule: DAYS.map((day) => ({
    day,
    enabled: !['Saturday', 'Sunday'].includes(day),
    start: '09:00',
    end: '18:00',
  })),
  timezone: 'America/New_York',
  holidays: [],
  holidayCalendarId: null,
  campaignStart: '',
  campaignEnd: '',
  dncListId: null,
  maxAttempts: 3,
  retryIntervalMinutes: 60,
  timeBetweenAttempts: 30,
  complianceNotes: '',
  contactFile: '',
  columnMapping: {},
  parsedContacts: [],
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

  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();
  const createContactList = useCreateContactList();
  const importContacts = useImportContacts();

  const currentStepKey = STEP_KEYS[step] ?? STEP_KEYS[0];
  const methods = useForm<CampaignFormValues>({
    defaultValues: DEFAULT_VALUES,
    // `raw: true` hands the submit callback the whole form, never a parse output stripped to the
    // schema's keys. The raw overload types the resolver over the schema's input, which names six
    // fields, hence the cast through `unknown` (design D7).
    resolver: zodResolver(
      campaignFormSchema as unknown as z.ZodType<CampaignFormValues, CampaignFormValues>,
      undefined,
      { raw: true },
    ),
  });

  const StepComponent = STEP_COMPONENTS[currentStepKey];
  const isFirst = step === 0;
  const isLast = step === STEP_KEYS.length - 1;

  const isPending =
    createCampaign.isPending ||
    startCampaign.isPending ||
    createContactList.isPending ||
    importContacts.isPending;

  /** Shows the first step holding an error, where its message renders; stays put if none does. */
  const showFirstStepWithError = (errors: FieldErrors<CampaignFormValues>) => {
    const index = firstStepWithError((field) => Boolean(errors[field]));
    if (index !== undefined) setStep(index);
  };

  /**
   * Moves to `target`. A later step first validates the fields of every step before it; on failure
   * the wizard shows the first step with an error instead. An earlier step moves without validating.
   */
  const goToStep = async (target: number) => {
    if (target <= step) {
      setStep(target);
      return;
    }
    const fields = STEP_KEYS.slice(0, target).flatMap((key) => STEP_FIELDS[key]);
    if (await methods.trigger(fields)) {
      setStep(target);
      return;
    }
    const index = firstStepWithError((field) => methods.getFieldState(field).invalid);
    if (index !== undefined) setStep(index);
  };

  const importContactsAfterCreate = (campaignId: number, formData: CampaignFormValues) => {
    const contacts = formData.parsedContacts;
    if (!contacts || contacts.length === 0) return;

    const fileName = formData.contactFile || 'contacts.csv';
    createContactList.mutate(
      {
        campaignId,
        name: fileName,
        sourceFileName: fileName,
        totalContacts: contacts.length,
        pendingContacts: contacts.length,
        completedContacts: 0,
      },
      {
        onSuccess: (list) => {
          importContacts.mutate({ campaignId, listId: list.id, contacts });
        },
      },
    );
  };

  const handleSaveDraft = methods.handleSubmit((formData) => {
    createCampaign.mutate(buildCreateCampaignBody(formData), {
      onSuccess: (result) => {
        importContactsAfterCreate(result.id, formData);
        navigate(`/admin/campaigns/${result.id}`);
      },
    });
  }, showFirstStepWithError);

  const handleLaunch = methods.handleSubmit((formData) => {
    createCampaign.mutate(buildCreateCampaignBody(formData), {
      onSuccess: (result) => {
        importContactsAfterCreate(result.id, formData);
        startCampaign.mutate(result.id, {
          onSuccess: () => {
            navigate(`/admin/campaigns/${result.id}`);
          },
        });
      },
    });
  }, showFirstStepWithError);

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:campaigns.wizardTitle')} />

      {/* Step indicator */}
      <nav className="flex gap-1">
        {STEP_KEYS.map((key, idx) => (
          <button
            key={key}
            type="button"
            onClick={() => void goToStep(idx)}
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
            <Button variant="outline" disabled={isFirst} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {t('admin:campaigns.previous')}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" disabled={isPending} onClick={handleSaveDraft}>
                <Save className="mr-1.5 h-4 w-4" />
                {createCampaign.isPending
                  ? t('admin:campaigns.saving')
                  : t('admin:campaigns.saveDraft')}
              </Button>

              {isLast ? (
                <Button disabled={isPending} onClick={handleLaunch}>
                  <Rocket className="mr-1.5 h-4 w-4" />
                  {isPending ? t('admin:campaigns.launching') : t('admin:campaigns.launch')}
                </Button>
              ) : (
                <Button onClick={() => void goToStep(step + 1)}>
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
