import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { useCallerIdPools } from '@/core/api/hooks/use-caller-id-pools';
import { useDialerSettings } from '@/core/api/hooks/use-dialer-settings';
import type { CampaignFormValues, DialingMode, PacingStrategy } from '../campaign-wizard';

const DIALING_MODE_VALUES: DialingMode[] = ['preview', 'progressive', 'predictive', 'power', 'agentless'];
const PACING_STRATEGY_VALUES: PacingStrategy[] = ['fixed', 'adaptive', 'timeBased'];

export default function DialingStep() {
  const { t } = useTranslation('admin');
  const { register, watch, setValue, formState: { errors } } = useFormContext<CampaignFormValues>();
  const selectedMode = watch('mode');
  const selectedPacing = watch('pacingStrategy');
  const callerIdPoolId = watch('callerIdPoolId');
  const useGlobalDefaults = watch('useGlobalDefaults');

  const { data: pools = [] } = useCallerIdPools();
  const { data: globalSettings } = useDialerSettings();

  return (
    <div className="space-y-6">
      {/* Dialing Mode */}
      <fieldset className="space-y-3">
        <span className="text-sm font-medium">{t('campaigns.dialing_step.mode_label')}</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DIALING_MODE_VALUES.map((mode) => (
            <label
              key={mode}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                selectedMode === mode
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                value={mode}
                className="sr-only"
                {...register('mode')}
              />
              <span className="text-sm font-medium">{t(`campaigns.dialing_step.modes.${mode}`)}</span>
              <p className="mt-1 text-xs text-muted-foreground">{t(`campaigns.dialing_step.modes.${mode}_desc`)}</p>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Pacing Strategy */}
      <fieldset className="space-y-3">
        <span className="text-sm font-medium">{t('campaigns.dialing_step.pacing_label')}</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {PACING_STRATEGY_VALUES.map((ps) => (
            <label
              key={ps}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                selectedPacing === ps
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                value={ps}
                className="sr-only"
                {...register('pacingStrategy')}
              />
              <span className="text-sm font-medium">{t(`campaigns.dialing_step.pacings.${ps}`)}</span>
              <p className="mt-1 text-xs text-muted-foreground">{t(`campaigns.dialing_step.pacings.${ps}_desc`)}</p>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Global Defaults Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">{t('campaigns.dialing_step.use_global_label')}</p>
          <p className="text-xs text-muted-foreground">
            {t('campaigns.dialing_step.use_global_help')}
          </p>
        </div>
        <Switch
          checked={useGlobalDefaults}
          onCheckedChange={(checked) => setValue('useGlobalDefaults', checked)}
        />
      </div>

      {/* Pacing Parameters */}
      {useGlobalDefaults ? (
        globalSettings && (
          <div className="grid gap-5 sm:grid-cols-3 rounded-lg border border-dashed p-4 opacity-70">
            <div className="space-y-1.5">
              <Label>{t('campaigns.dialing_step.max_global_channels')}</Label>
              <p className="text-sm font-medium text-muted-foreground">{globalSettings.maxGlobalChannels}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('campaigns.dialing_step.ring_timeout')}</Label>
              <p className="text-sm font-medium text-muted-foreground">{globalSettings.defaultRingTimeoutSeconds}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('campaigns.dialing_step.max_concurrent_campaigns')}</Label>
              <p className="text-sm font-medium text-muted-foreground">{globalSettings.maxConcurrentCampaigns}</p>
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          {selectedPacing === 'fixed' && (
            <div className="space-y-1.5">
              <Label htmlFor="pacingRatio">{t('campaigns.dialing_step.lines_per_agent')}</Label>
              <Input
                id="pacingRatio"
                type="number"
                min={1}
                max={10}
                {...register('pacingRatio', { valueAsNumber: true })}
              />
            </div>
          )}

          {selectedPacing === 'adaptive' && (
            <div className="space-y-1.5">
              <Label htmlFor="pacingTargetWait">{t('campaigns.dialing_step.target_wait')}</Label>
              <Input
                id="pacingTargetWait"
                type="number"
                min={1}
                max={120}
                {...register('pacingTargetWait', { valueAsNumber: true })}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="maxChannels">{t('campaigns.dialing_step.max_channels')}</Label>
            <Input
              id="maxChannels"
              type="number"
              min={1}
              max={500}
              {...register('maxChannels', { valueAsNumber: true })}
            />
            {errors.maxChannels && <p className="text-sm text-destructive">{errors.maxChannels.message}</p>}
          </div>
        </div>
      )}

      {/* Caller ID Pool */}
      <div className="space-y-1.5">
        <Label>{t('campaigns.dialing_step.caller_id_pool')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('campaigns.dialing_step.caller_id_pool_help')}
        </p>
        <Select
          value={callerIdPoolId !== null ? String(callerIdPoolId) : 'none'}
          onValueChange={(val) =>
            setValue('callerIdPoolId', val === 'none' ? null : Number(val))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('campaigns.dialing_step.select_pool_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('campaigns.dialing_step.pool_none')}</SelectItem>
            {pools.map((pool) => (
              <SelectItem key={pool.id} value={String(pool.id)}>
                {pool.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
