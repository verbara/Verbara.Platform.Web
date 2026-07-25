import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { PageHeader } from '@/core/ui/page-header';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import {
  useHolidayCalendar,
  useHolidayCalendarHolidays,
  useAddHoliday,
  useRemoveHoliday,
} from '@/core/api/hooks/use-holiday-calendars';

interface AddHolidayForm {
  name: string;
  date: string;
  allowedStartTime: string;
  allowedEndTime: string;
}

const DEFAULT_FORM: AddHolidayForm = {
  name: '',
  date: '',
  allowedStartTime: '',
  allowedEndTime: '',
};

export default function HolidayCalendarDetailPage() {
  const { t } = useTranslation('admin');
  const { calendarId } = useParams<{ calendarId: string }>();
  const navigate = useNavigate();
  const calendarIdNum = Number(calendarId);

  const { data: calendar, isLoading: calendarLoading } = useHolidayCalendar(calendarIdNum);
  const { data: holidays = [], isLoading: holidaysLoading } =
    useHolidayCalendarHolidays(calendarIdNum);

  const addHoliday = useAddHoliday();
  const removeHoliday = useRemoveHoliday();

  const [form, setForm] = useState<AddHolidayForm>(DEFAULT_FORM);

  const isLoading = calendarLoading || holidaysLoading;

  if (isLoading) {
    return <PageSkeleton variant="form" />;
  }

  if (!calendar) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('holiday-calendars.detail.not_found')}
      </div>
    );
  }

  const handleAdd = () => {
    if (!form.name.trim() || !form.date) return;
    addHoliday.mutate(
      {
        calendarId: calendarIdNum,
        name: form.name.trim(),
        date: form.date,
        allowedStartTime: form.allowedStartTime || undefined,
        allowedEndTime: form.allowedEndTime || undefined,
      },
      { onSuccess: () => setForm(DEFAULT_FORM) },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/holiday-calendars')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t('holiday-calendars.detail.back')}
      </Button>

      {/* Header */}
      <PageHeader title={calendar.name} description={t('holiday-calendars.detail.description')} />

      {/* Add holiday form */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('holiday-calendars.detail.add_holiday')}
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="holidayName">{t('holiday-calendars.detail.name')}</Label>
              <Input
                id="holidayName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('holiday-calendars.detail.name_placeholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holidayDate">{t('holiday-calendars.detail.date')}</Label>
              <Input
                id="holidayDate"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="allowedStart">{t('holiday-calendars.detail.allowed_start')}</Label>
              <Input
                id="allowedStart"
                type="time"
                value={form.allowedStartTime}
                onChange={(e) => setForm((f) => ({ ...f, allowedStartTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="allowedEnd">{t('holiday-calendars.detail.allowed_end')}</Label>
              <Input
                id="allowedEnd"
                type="time"
                value={form.allowedEndTime}
                onChange={(e) => setForm((f) => ({ ...f, allowedEndTime: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAdd}
              disabled={addHoliday.isPending || !form.name.trim() || !form.date}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {addHoliday.isPending
                ? t('holiday-calendars.detail.adding')
                : t('holiday-calendars.detail.add')}
            </Button>
          </div>
        </div>
      </div>

      {/* Holidays table */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('holiday-calendars.detail.holidays_title', { count: holidays.length })}
        </p>

        {holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('holiday-calendars.detail.no_holidays')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('holiday-calendars.detail.col_name')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('holiday-calendars.detail.col_date')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('holiday-calendars.detail.col_allowed_start')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('holiday-calendars.detail.col_allowed_end')}
                  </th>
                  <th className="px-3 py-2" aria-label={t('common:table.col_actions')} />
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{h.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{h.date}</td>
                    <td className="px-3 py-2 text-muted-foreground">{h.allowedStartTime ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{h.allowedEndTime ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() =>
                          removeHoliday.mutate({
                            calendarId: calendarIdNum,
                            holidayId: h.id,
                          })
                        }
                        disabled={removeHoliday.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
