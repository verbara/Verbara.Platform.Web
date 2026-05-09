import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Separator } from '@/core/ui/separator';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { useDialerSettings, useUpdateDialerSettings } from '@/core/api/hooks/use-dialer-settings';
import { PageSkeleton } from '@/core/ui/page-skeleton';

const dialerSettingsSchema = z.object({
  maxGlobalChannels: z.number().int().min(1),
  defaultRingTimeoutSeconds: z.number().int().min(1),
  campaignPollIntervalSeconds: z.number().int().min(1),
  maxConcurrentCampaigns: z.number().int().min(1),
  blendModeEnabled: z.boolean(),
  jitterMinMs: z.number().int().min(0),
  jitterMaxMs: z.number().int().min(0),
  ahtCacheDurationSeconds: z.number().int().min(1),
  scheduledCallbackPollSeconds: z.number().int().min(1),
});

type DialerSettingsFormValues = z.infer<typeof dialerSettingsSchema>;

const DEFAULT_VALUES: DialerSettingsFormValues = {
  maxGlobalChannels: 100,
  defaultRingTimeoutSeconds: 30,
  campaignPollIntervalSeconds: 30,
  maxConcurrentCampaigns: 10,
  blendModeEnabled: false,
  jitterMinMs: 0,
  jitterMaxMs: 500,
  ahtCacheDurationSeconds: 300,
  scheduledCallbackPollSeconds: 60,
};

export default function DialerSettingsPage() {
  const { t } = useTranslation('admin');
  const { data: settings, isLoading } = useDialerSettings();
  const updateSettings = useUpdateDialerSettings();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<DialerSettingsFormValues>({
    resolver: zodResolver(dialerSettingsSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (settings) {
      reset(settings as DialerSettingsFormValues);
    }
  }, [settings, reset]);

  const onSubmit = handleSubmit((values: DialerSettingsFormValues) => {
    updateSettings.mutate(values);
  });

  const blendModeEnabled = useWatch({ control, name: 'blendModeEnabled' });

  const maxGlobalChannelsA11y = useFieldA11y(errors.maxGlobalChannels, 'maxGlobalChannels', {
    required: true,
  });
  const maxConcurrentCampaignsA11y = useFieldA11y(
    errors.maxConcurrentCampaigns,
    'maxConcurrentCampaigns',
    { required: true },
  );
  const defaultRingTimeoutA11y = useFieldA11y(
    errors.defaultRingTimeoutSeconds,
    'defaultRingTimeoutSeconds',
    { required: true },
  );
  const campaignPollIntervalA11y = useFieldA11y(
    errors.campaignPollIntervalSeconds,
    'campaignPollIntervalSeconds',
    { required: true },
  );
  const scheduledCallbackPollA11y = useFieldA11y(
    errors.scheduledCallbackPollSeconds,
    'scheduledCallbackPollSeconds',
    { required: true },
  );
  const ahtCacheDurationA11y = useFieldA11y(
    errors.ahtCacheDurationSeconds,
    'ahtCacheDurationSeconds',
    { required: true },
  );
  const jitterMinA11y = useFieldA11y(errors.jitterMinMs, 'jitterMinMs', { required: true });
  const jitterMaxA11y = useFieldA11y(errors.jitterMaxMs, 'jitterMaxMs', { required: true });

  return (
    <div className="space-y-8" data-testid="dialer-settings-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">{t('dialer-settings.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dialer-settings.description')}</p>
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton variant="form" />
      ) : (
        <form onSubmit={onSubmit} className="max-w-lg space-y-8">
          {/* Capacity */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('dialer-settings.sections.capacity')}
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="maxGlobalChannels" required>
                {t('dialer-settings.fields.max_global_channels')}
              </Label>
              <Input
                id="maxGlobalChannels"
                type="number"
                min={1}
                {...maxGlobalChannelsA11y.inputProps}
                {...register('maxGlobalChannels', { valueAsNumber: true })}
              />
              <FieldError
                id={maxGlobalChannelsA11y.errorId}
                message={errors.maxGlobalChannels?.message}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxConcurrentCampaigns" required>
                {t('dialer-settings.fields.max_concurrent_campaigns')}
              </Label>
              <Input
                id="maxConcurrentCampaigns"
                type="number"
                min={1}
                {...maxConcurrentCampaignsA11y.inputProps}
                {...register('maxConcurrentCampaigns', { valueAsNumber: true })}
              />
              <FieldError
                id={maxConcurrentCampaignsA11y.errorId}
                message={errors.maxConcurrentCampaigns?.message}
              />
            </div>
          </section>

          <Separator />

          {/* Timing */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('dialer-settings.sections.timing')}
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="defaultRingTimeoutSeconds" required>
                {t('dialer-settings.fields.default_ring_timeout')}
              </Label>
              <Input
                id="defaultRingTimeoutSeconds"
                type="number"
                min={1}
                {...defaultRingTimeoutA11y.inputProps}
                {...register('defaultRingTimeoutSeconds', { valueAsNumber: true })}
              />
              <FieldError
                id={defaultRingTimeoutA11y.errorId}
                message={errors.defaultRingTimeoutSeconds?.message}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="campaignPollIntervalSeconds" required>
                {t('dialer-settings.fields.campaign_poll_interval')}
              </Label>
              <Input
                id="campaignPollIntervalSeconds"
                type="number"
                min={1}
                {...campaignPollIntervalA11y.inputProps}
                {...register('campaignPollIntervalSeconds', { valueAsNumber: true })}
              />
              <FieldError
                id={campaignPollIntervalA11y.errorId}
                message={errors.campaignPollIntervalSeconds?.message}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scheduledCallbackPollSeconds" required>
                {t('dialer-settings.fields.scheduled_callback_poll')}
              </Label>
              <Input
                id="scheduledCallbackPollSeconds"
                type="number"
                min={1}
                {...scheduledCallbackPollA11y.inputProps}
                {...register('scheduledCallbackPollSeconds', { valueAsNumber: true })}
              />
              <FieldError
                id={scheduledCallbackPollA11y.errorId}
                message={errors.scheduledCallbackPollSeconds?.message}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ahtCacheDurationSeconds" required>
                {t('dialer-settings.fields.aht_cache_duration')}
              </Label>
              <Input
                id="ahtCacheDurationSeconds"
                type="number"
                min={1}
                {...ahtCacheDurationA11y.inputProps}
                {...register('ahtCacheDurationSeconds', { valueAsNumber: true })}
              />
              <FieldError
                id={ahtCacheDurationA11y.errorId}
                message={errors.ahtCacheDurationSeconds?.message}
              />
            </div>
          </section>

          <Separator />

          {/* Jitter */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('dialer-settings.sections.jitter')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('dialer-settings.jitter_help')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="jitterMinMs" required>
                  {t('dialer-settings.fields.min_jitter')}
                </Label>
                <Input
                  id="jitterMinMs"
                  type="number"
                  min={0}
                  {...jitterMinA11y.inputProps}
                  {...register('jitterMinMs', { valueAsNumber: true })}
                />
                <FieldError id={jitterMinA11y.errorId} message={errors.jitterMinMs?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jitterMaxMs" required>
                  {t('dialer-settings.fields.max_jitter')}
                </Label>
                <Input
                  id="jitterMaxMs"
                  type="number"
                  min={0}
                  {...jitterMaxA11y.inputProps}
                  {...register('jitterMaxMs', { valueAsNumber: true })}
                />
                <FieldError id={jitterMaxA11y.errorId} message={errors.jitterMaxMs?.message} />
              </div>
            </div>
          </section>

          <Separator />

          {/* Blend mode */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('dialer-settings.sections.blend_mode')}
            </h2>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('dialer-settings.blend_mode_label')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('dialer-settings.blend_mode_help')}
                </p>
              </div>
              <Switch
                checked={blendModeEnabled}
                onCheckedChange={(checked) =>
                  setValue('blendModeEnabled', checked, { shouldDirty: true })
                }
                aria-label={t('dialer-settings.blend_mode_aria')}
              />
            </div>
          </section>

          <Button
            type="submit"
            disabled={!isDirty || updateSettings.isPending}
            data-testid="dialer-settings-save-btn"
          >
            <Save className="mr-2 h-4 w-4" />
            {updateSettings.isPending ? t('dialer-settings.saving') : t('dialer-settings.save')}
          </Button>
        </form>
      )}
    </div>
  );
}
