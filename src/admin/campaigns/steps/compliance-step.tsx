import { useFormContext } from 'react-hook-form';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { Switch } from '@/core/ui/switch';
import type { CampaignFormValues } from '../campaign-wizard';

export default function ComplianceStep() {
  const { register, watch, setValue } = useFormContext<CampaignFormValues>();
  const dncEnabled = watch('dncEnabled');

  return (
    <div className="space-y-6">
      {/* DNC Check */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Do-Not-Call (DNC) Check</p>
          <p className="text-xs text-muted-foreground">
            Verify each contact against the DNC registry before dialing.
          </p>
        </div>
        <Switch
          checked={dncEnabled}
          onCheckedChange={(checked) => setValue('dncEnabled', checked)}
        />
      </div>

      {/* Attempt Limits */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="maxAttempts">Max Attempts per Contact</Label>
          <Input
            id="maxAttempts"
            type="number"
            min={1}
            max={20}
            {...register('maxAttempts', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="retryIntervalMinutes">Retry Interval (minutes)</Label>
          <Input
            id="retryIntervalMinutes"
            type="number"
            min={1}
            max={1440}
            {...register('retryIntervalMinutes', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timeBetweenAttempts">Time Between Attempts (min)</Label>
          <Input
            id="timeBetweenAttempts"
            type="number"
            min={1}
            max={1440}
            {...register('timeBetweenAttempts', { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Compliance Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="complianceNotes">Compliance Rule Summary</Label>
        <Textarea
          id="complianceNotes"
          placeholder="Describe any additional compliance rules or notes for this campaign..."
          rows={4}
          {...register('complianceNotes')}
        />
      </div>
    </div>
  );
}
