import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Button } from '@/core/ui/button';
import type { CampaignFormValues } from '../campaign-wizard';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Bogota',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Madrid',
  'UTC',
];

export default function ScheduleStep() {
  const { register, control, watch, setValue } = useFormContext<CampaignFormValues>();
  const holidays = watch('holidays') ?? [];

  const { fields: scheduleFields } = useFieldArray({ control, name: 'schedule' as never });
  const schedule = watch('schedule');

  const addHoliday = () => {
    const input = document.getElementById('holiday-input') as HTMLInputElement;
    const val = input?.value;
    if (val && !holidays.includes(val)) {
      setValue('holidays', [...holidays, val]);
      input.value = '';
    }
  };

  const removeHoliday = (date: string) => {
    setValue('holidays', holidays.filter((h) => h !== date));
  };

  return (
    <div className="space-y-6">
      {/* Calling Windows */}
      <div className="space-y-3">
        <Label>Calling Windows</Label>
        <div className="space-y-2">
          {scheduleFields.map((field, idx) => {
            const day = schedule?.[idx];
            return (
              <div key={field.id} className="flex items-center gap-3">
                <label className="flex w-24 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded"
                    {...register(`schedule.${idx}.enabled` as const)}
                  />
                  {day?.day ?? ''}
                </label>
                <Input
                  type="time"
                  className="w-32"
                  disabled={!day?.enabled}
                  {...register(`schedule.${idx}.start` as const)}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="w-32"
                  disabled={!day?.enabled}
                  {...register(`schedule.${idx}.end` as const)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Timezone */}
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register('timezone')}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Campaign Dates */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="campaignStart">Start Date</Label>
          <Input id="campaignStart" type="date" {...register('campaignStart')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaignEnd">End Date</Label>
          <Input id="campaignEnd" type="date" {...register('campaignEnd')} />
        </div>
      </div>

      {/* Holiday Exclusions */}
      <div className="space-y-3">
        <Label>Holiday Exclusions</Label>
        <div className="flex gap-2">
          <Input id="holiday-input" type="date" className="w-48" />
          <Button type="button" variant="outline" size="sm" onClick={addHoliday}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        {holidays.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {holidays.map((date) => (
              <span
                key={date}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
              >
                {date}
                <button type="button" onClick={() => removeHoliday(date)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
