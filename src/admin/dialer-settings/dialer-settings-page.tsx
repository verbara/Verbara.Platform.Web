import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Separator } from '@/core/ui/separator';
import {
  useDialerSettings,
  useUpdateDialerSettings,
} from '@/core/api/hooks/use-dialer-settings';

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
  const { data: settings, isLoading } = useDialerSettings();
  const updateSettings = useUpdateDialerSettings();

  const {
    register,
    handleSubmit,
    reset,
    watch,
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

  const blendModeEnabled = watch('blendModeEnabled');

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-2xl font-semibold">Dialer Settings</h1>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dialer-settings-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">Dialer Settings</h1>
          <p className="text-sm text-muted-foreground">
            Global configuration for the outbound dialer engine.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="max-w-lg space-y-8">
        {/* Capacity */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Capacity
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="maxGlobalChannels">Max Global Channels</Label>
            <Input
              id="maxGlobalChannels"
              type="number"
              min={1}
              aria-invalid={!!errors.maxGlobalChannels}
              {...register('maxGlobalChannels', { valueAsNumber: true })}
            />
            {errors.maxGlobalChannels && (
              <p className="text-xs text-destructive">{errors.maxGlobalChannels.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxConcurrentCampaigns">Max Concurrent Campaigns</Label>
            <Input
              id="maxConcurrentCampaigns"
              type="number"
              min={1}
              aria-invalid={!!errors.maxConcurrentCampaigns}
              {...register('maxConcurrentCampaigns', { valueAsNumber: true })}
            />
            {errors.maxConcurrentCampaigns && (
              <p className="text-xs text-destructive">{errors.maxConcurrentCampaigns.message}</p>
            )}
          </div>
        </section>

        <Separator />

        {/* Timing */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Timing
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="defaultRingTimeoutSeconds">Default Ring Timeout (seconds)</Label>
            <Input
              id="defaultRingTimeoutSeconds"
              type="number"
              min={1}
              aria-invalid={!!errors.defaultRingTimeoutSeconds}
              {...register('defaultRingTimeoutSeconds', { valueAsNumber: true })}
            />
            {errors.defaultRingTimeoutSeconds && (
              <p className="text-xs text-destructive">{errors.defaultRingTimeoutSeconds.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaignPollIntervalSeconds">Campaign Poll Interval (seconds)</Label>
            <Input
              id="campaignPollIntervalSeconds"
              type="number"
              min={1}
              aria-invalid={!!errors.campaignPollIntervalSeconds}
              {...register('campaignPollIntervalSeconds', { valueAsNumber: true })}
            />
            {errors.campaignPollIntervalSeconds && (
              <p className="text-xs text-destructive">{errors.campaignPollIntervalSeconds.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduledCallbackPollSeconds">Scheduled Callback Poll (seconds)</Label>
            <Input
              id="scheduledCallbackPollSeconds"
              type="number"
              min={1}
              aria-invalid={!!errors.scheduledCallbackPollSeconds}
              {...register('scheduledCallbackPollSeconds', { valueAsNumber: true })}
            />
            {errors.scheduledCallbackPollSeconds && (
              <p className="text-xs text-destructive">{errors.scheduledCallbackPollSeconds.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ahtCacheDurationSeconds">AHT Cache Duration (seconds)</Label>
            <Input
              id="ahtCacheDurationSeconds"
              type="number"
              min={1}
              aria-invalid={!!errors.ahtCacheDurationSeconds}
              {...register('ahtCacheDurationSeconds', { valueAsNumber: true })}
            />
            {errors.ahtCacheDurationSeconds && (
              <p className="text-xs text-destructive">{errors.ahtCacheDurationSeconds.message}</p>
            )}
          </div>
        </section>

        <Separator />

        {/* Jitter */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Jitter
          </h2>
          <p className="text-sm text-muted-foreground">
            Random delay added between originate attempts to avoid thundering-herd patterns.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jitterMinMs">Min Jitter (ms)</Label>
              <Input
                id="jitterMinMs"
                type="number"
                min={0}
                aria-invalid={!!errors.jitterMinMs}
                {...register('jitterMinMs', { valueAsNumber: true })}
              />
              {errors.jitterMinMs && (
                <p className="text-xs text-destructive">{errors.jitterMinMs.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jitterMaxMs">Max Jitter (ms)</Label>
              <Input
                id="jitterMaxMs"
                type="number"
                min={0}
                aria-invalid={!!errors.jitterMaxMs}
                {...register('jitterMaxMs', { valueAsNumber: true })}
              />
              {errors.jitterMaxMs && (
                <p className="text-xs text-destructive">{errors.jitterMaxMs.message}</p>
              )}
            </div>
          </div>
        </section>

        <Separator />

        {/* Blend mode */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Blend Mode
          </h2>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Enable Blend Mode</p>
              <p className="text-xs text-muted-foreground">
                Allow agents to handle both inbound and outbound calls simultaneously.
              </p>
            </div>
            <Switch
              checked={blendModeEnabled}
              onCheckedChange={(checked) =>
                setValue('blendModeEnabled', checked, { shouldDirty: true })
              }
              aria-label="Blend mode enabled"
            />
          </div>
        </section>

        <Button type="submit" disabled={!isDirty || updateSettings.isPending} data-testid="dialer-settings-save-btn">
          <Save className="mr-2 h-4 w-4" />
          {updateSettings.isPending ? 'Saving…' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
