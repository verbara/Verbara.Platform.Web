import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface HolidayCalendarSummary {
  id: number;
  name: string;
}

/** A holiday as Platform returns it; the window is `allowedStart` / `allowedEnd` (`HH:mm`, or null). */
export type Holiday = components['schemas']['HolidayDto'];

type AddHolidayRequest = components['schemas']['AddHolidayRequest'];

/** What the console posts to add a holiday; a window bound left out is sent as absent. */
export type AddHolidayInput = Pick<AddHolidayRequest, 'name' | 'date'> &
  Partial<Pick<AddHolidayRequest, 'allowedStart' | 'allowedEnd'>>;

export function useHolidayCalendars() {
  return useQuery({
    queryKey: ['holiday-calendars'],
    queryFn: () =>
      customFetch<HolidayCalendarSummary[]>({
        url: '/api/v1/admin/holiday-calendars',
        method: 'GET',
      }),
  });
}

export function useHolidayCalendar(id: number) {
  return useQuery({
    queryKey: ['holiday-calendar', id],
    queryFn: () =>
      customFetch<HolidayCalendarSummary>({
        url: `/api/v1/admin/holiday-calendars/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useHolidayCalendarHolidays(calendarId: number) {
  return useQuery({
    queryKey: ['holiday-calendar-holidays', calendarId],
    queryFn: () =>
      customFetch<Holiday[]>({
        url: `/api/v1/admin/holiday-calendars/${calendarId}/holidays`,
        method: 'GET',
      }),
    enabled: !!calendarId,
  });
}

export function useCreateCalendar() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<Omit<HolidayCalendarSummary, 'id'>>) =>
      customFetch<HolidayCalendarSummary>({
        url: '/api/v1/admin/holiday-calendars',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holiday-calendars'] });
      toast.success(t('toasts.holidayCalendars.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCalendar() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Omit<HolidayCalendarSummary, 'id'>>) =>
      customFetch<HolidayCalendarSummary>({
        url: `/api/v1/admin/holiday-calendars/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['holiday-calendars'] });
      qc.invalidateQueries({ queryKey: ['holiday-calendar', variables.id] });
      toast.success(t('toasts.holidayCalendars.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCalendar() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/holiday-calendars/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holiday-calendars'] });
      toast.success(t('toasts.holidayCalendars.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddHoliday() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ calendarId, ...data }: { calendarId: number } & AddHolidayInput) =>
      customFetch<Holiday>({
        url: `/api/v1/admin/holiday-calendars/${calendarId}/holidays`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['holiday-calendar-holidays', variables.calendarId] });
      toast.success(t('toasts.holidayCalendars.holidayAdded'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveHoliday() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ calendarId, holidayId }: { calendarId: number; holidayId: number }) =>
      customFetch<void>({
        url: `/api/v1/admin/holiday-calendars/${calendarId}/holidays/${holidayId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['holiday-calendar-holidays', variables.calendarId] });
      toast.success(t('toasts.holidayCalendars.holidayRemoved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
