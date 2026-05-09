import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Button } from '@/core/ui/button';
import { FieldError } from '@/core/ui/field-error';
import { TimezoneSelect } from '@/core/ui/timezone-select';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useHolidayCalendars } from '@/core/api/hooks/use-holiday-calendars';
import type { CampaignFormValues } from '../campaign-wizard';

export default function ScheduleStep() {
  const { t } = useTranslation('admin');
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CampaignFormValues>();
  const holidays = watch('holidays') ?? [];
  const holidayCalendarId = watch('holidayCalendarId');
  const { data: calendars = [] } = useHolidayCalendars();

  const { fields: scheduleFields } = useFieldArray({ control, name: 'schedule' as never });
  const schedule = watch('schedule');

  const timezoneA11y = useFieldA11y(errors.timezone, 'timezone', { required: true });
  const campaignStartA11y = useFieldA11y(errors.campaignStart, 'campaignStart', { required: true });

  const addHoliday = () => {
    const input = document.getElementById('holiday-input') as HTMLInputElement;
    const val = input?.value;
    if (val && !holidays.includes(val)) {
      setValue('holidays', [...holidays, val]);
      input.value = '';
    }
  };

  const removeHoliday = (date: string) => {
    setValue(
      'holidays',
      holidays.filter((h) => h !== date),
    );
  };

  return (
    <div className="space-y-6">
      {/* Calling Windows */}
      <div className="space-y-3">
        <Label>{t('campaigns.schedule_step.calling_windows')}</Label>
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
                <span className="text-sm text-muted-foreground">
                  {t('campaigns.schedule_step.to')}
                </span>
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
        <Label htmlFor="timezone" required>
          {t('campaigns.schedule_step.timezone')}
        </Label>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <TimezoneSelect
              id="timezone"
              value={field.value ?? ''}
              onChange={field.onChange}
              autoDetect
              aria-invalid={timezoneA11y.inputProps['aria-invalid']}
              aria-describedby={timezoneA11y.inputProps['aria-describedby']}
            />
          )}
        />
        <FieldError
          id={timezoneA11y.errorId}
          message={errors.timezone ? t(errors.timezone.message ?? '') : undefined}
        />
      </div>

      {/* Campaign Dates */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="campaignStart" required>
            {t('campaigns.schedule_step.start_date')}
          </Label>
          <Input
            id="campaignStart"
            type="date"
            {...campaignStartA11y.inputProps}
            {...register('campaignStart')}
          />
          <FieldError
            id={campaignStartA11y.errorId}
            message={errors.campaignStart ? t(errors.campaignStart.message ?? '') : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaignEnd">{t('campaigns.schedule_step.end_date')}</Label>
          <Input id="campaignEnd" type="date" {...register('campaignEnd')} />
        </div>
      </div>

      {/* Holiday Calendar */}
      <div className="space-y-1.5">
        <Label>{t('campaigns.schedule_step.holiday_calendar')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('campaigns.schedule_step.holiday_calendar_help')}
        </p>
        <Select
          value={holidayCalendarId !== null ? String(holidayCalendarId) : 'none'}
          onValueChange={(val) =>
            setValue('holidayCalendarId', val === 'none' ? null : Number(val))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('campaigns.schedule_step.select_calendar_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('campaigns.schedule_step.calendar_none')}</SelectItem>
            {calendars.map((cal) => (
              <SelectItem key={cal.id} value={String(cal.id)}>
                {cal.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Holiday Exclusions */}
      <div className="space-y-3">
        <Label>{t('campaigns.schedule_step.manual_exclusions')}</Label>
        <div className="flex gap-2">
          <Input id="holiday-input" type="date" className="w-48" />
          <Button type="button" variant="outline" size="sm" onClick={addHoliday}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('campaigns.schedule_step.add')}
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
                <button
                  type="button"
                  onClick={() => removeHoliday(date)}
                  className="text-muted-foreground hover:text-foreground"
                >
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
