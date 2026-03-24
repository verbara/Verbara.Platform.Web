import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { CalendarOff } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import {
  useHolidayCalendars,
  type HolidayCalendarSummary,
} from '@/core/api/hooks/use-holiday-calendars';

const columnHelper = createColumnHelper<HolidayCalendarSummary>();

export default function HolidayCalendarsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useHolidayCalendars();
  const calendars: HolidayCalendarSummary[] = data ?? [];

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => 'Name',
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Holiday Calendars" />
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holiday Calendars"
        description="Define holiday dates to block outbound dialing."
      />

      {calendars.length === 0 ? (
        <EmptyState icon={CalendarOff} message="No holiday calendars configured yet." />
      ) : (
        <DataTable
          data={calendars}
          columns={columns}
          searchPlaceholder="Search calendars…"
          noResultsMessage="No matching calendars found."
          onRowClick={(calendar) => navigate(`/admin/holiday-calendars/${calendar.id}`)}
        />
      )}
    </div>
  );
}
