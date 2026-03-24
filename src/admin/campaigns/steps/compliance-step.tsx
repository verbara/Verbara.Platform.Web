import { useFormContext } from 'react-hook-form';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { useDncLists } from '@/core/api/hooks/use-dnc-lists';
import type { CampaignFormValues } from '../campaign-wizard';

export default function ComplianceStep() {
  const { register, watch, setValue } = useFormContext<CampaignFormValues>();
  const dncListId = watch('dncListId');
  const { data: dncLists = [] } = useDncLists();

  return (
    <div className="space-y-6">
      {/* DNC List */}
      <div className="space-y-1.5">
        <Label htmlFor="dncListId">Do-Not-Call (DNC) List</Label>
        <p className="text-xs text-muted-foreground">
          Contacts will be verified against the selected DNC list before dialing. Select "None" to skip DNC checking.
        </p>
        <Select
          value={dncListId !== null ? String(dncListId) : 'none'}
          onValueChange={(val) =>
            setValue('dncListId', val === 'none' ? null : Number(val))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a DNC list..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (skip DNC check)</SelectItem>
            {dncLists.map((list) => (
              <SelectItem key={list.id} value={String(list.id)}>
                {list.name}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({list.entryCount.toLocaleString()} entries)
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
