import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { CalendarOff, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import {
  useHolidayCalendars,
  useDeleteCalendar,
  type HolidayCalendarSummary,
} from '@/core/api/hooks/use-holiday-calendars';

const columnHelper = createColumnHelper<HolidayCalendarSummary>();

export default function HolidayCalendarsPage() {
  const navigate = useNavigate();
  const [deletingCalendar, setDeletingCalendar] = useState<HolidayCalendarSummary | null>(null);
  const deleteCalendar = useDeleteCalendar();
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
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="campaigns:calendar:manage">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingCalendar(info.row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGuard>
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

      <ConfirmDeleteDialog
        open={deletingCalendar !== null}
        onOpenChange={(open) => { if (!open) setDeletingCalendar(null); }}
        onConfirm={() => {
          if (!deletingCalendar) return;
          deleteCalendar.mutate(deletingCalendar.id, {
            onSuccess: () => setDeletingCalendar(null),
          });
        }}
        entityName={deletingCalendar?.name ?? ''}
        entityType="Holiday Calendar"
        isPending={deleteCalendar.isPending}
      />
    </div>
  );
}
