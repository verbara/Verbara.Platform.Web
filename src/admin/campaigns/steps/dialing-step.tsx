import { useFormContext } from 'react-hook-form';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import type { CampaignFormValues, DialingMode, PacingStrategy } from '../campaign-wizard';

const DIALING_MODES: { value: DialingMode; label: string; description: string }[] = [
  { value: 'preview', label: 'Preview', description: 'Agent sees contact info before dialing and decides when to call.' },
  { value: 'progressive', label: 'Progressive', description: 'System dials automatically when an agent becomes available. One call per agent.' },
  { value: 'predictive', label: 'Predictive', description: 'System dials multiple numbers ahead of agent availability using statistical pacing.' },
  { value: 'power', label: 'Power', description: 'Dials a fixed ratio of calls per available agent. Simpler than predictive.' },
  { value: 'agentless', label: 'Agentless', description: 'Fully automated dialing with no live agents. Uses IVR or recorded messages.' },
];

const PACING_STRATEGIES: { value: PacingStrategy; label: string; description: string }[] = [
  { value: 'fixed', label: 'Fixed Ratio', description: 'Dial a fixed number of lines per available agent.' },
  { value: 'adaptive', label: 'Adaptive', description: 'Automatically adjusts pacing to meet a target agent wait time.' },
  { value: 'timeBased', label: 'Time-Based', description: 'Adjusts pacing based on time-of-day patterns.' },
];

export default function DialingStep() {
  const { register, watch } = useFormContext<CampaignFormValues>();
  const selectedMode = watch('mode');
  const selectedPacing = watch('pacingStrategy');

  return (
    <div className="space-y-6">
      {/* Dialing Mode */}
      <fieldset className="space-y-3">
        <span className="text-sm font-medium">Dialing Mode</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DIALING_MODES.map((mode) => (
            <label
              key={mode.value}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                selectedMode === mode.value
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                value={mode.value}
                className="sr-only"
                {...register('mode')}
              />
              <span className="text-sm font-medium">{mode.label}</span>
              <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Pacing Strategy */}
      <fieldset className="space-y-3">
        <span className="text-sm font-medium">Pacing Strategy</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {PACING_STRATEGIES.map((ps) => (
            <label
              key={ps.value}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                selectedPacing === ps.value
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                value={ps.value}
                className="sr-only"
                {...register('pacingStrategy')}
              />
              <span className="text-sm font-medium">{ps.label}</span>
              <p className="mt-1 text-xs text-muted-foreground">{ps.description}</p>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Pacing Parameters */}
      <div className="grid gap-5 sm:grid-cols-3">
        {selectedPacing === 'fixed' && (
          <div className="space-y-1.5">
            <Label htmlFor="pacingRatio">Lines per Agent</Label>
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
            <Label htmlFor="pacingTargetWait">Target Wait (seconds)</Label>
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
          <Label htmlFor="maxChannels">Max Channels</Label>
          <Input
            id="maxChannels"
            type="number"
            min={1}
            max={500}
            {...register('maxChannels', { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  );
}
