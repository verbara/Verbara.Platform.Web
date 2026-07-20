import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { CalendarOff, Trash2, Plus, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { DataTable } from '@/core/ui/data-table';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { PermissionButton } from '@/core/ui/permission-button';
import {
  useHolidayCalendars,
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
  type HolidayCalendarSummary,
} from '@/core/api/hooks/use-holiday-calendars';

const columnHelper = createColumnHelper<HolidayCalendarSummary>();

export default function HolidayCalendarsPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [deletingCalendar, setDeletingCalendar] = useState<HolidayCalendarSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<HolidayCalendarSummary | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const deleteCalendar = useDeleteCalendar();
  const createCalendar = useCreateCalendar();
  const updateCalendar = useUpdateCalendar();
  const { data, isLoading } = useHolidayCalendars();
  const calendars: HolidayCalendarSummary[] = data ?? [];

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('holiday-calendars.columns.name'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <PermissionGuard requires="campaigns:calendar:manage">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  const cal = info.row.original;
                  setEditingCalendar(cal);
                  setFormData({ name: cal.name });
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                data-testid={`delete-calendar-${info.row.original.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingCalendar(info.row.original);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </PermissionGuard>
        ),
      }),
    ],
    [t],
  );

  const isEmpty = !isLoading && calendars.length === 0;

  let listContent: React.ReactNode;
  if (isLoading) {
    listContent = <PageSkeleton />;
  } else if (isEmpty) {
    listContent = <EmptyState icon={CalendarOff} message={t('holiday-calendars.empty')} />;
  } else {
    listContent = (
      <DataTable
        data={calendars}
        columns={columns}
        searchPlaceholder={t('holiday-calendars.search_placeholder')}
        noResultsMessage={t('holiday-calendars.no_results')}
        onRowClick={(calendar) => navigate(`/admin/holiday-calendars/${calendar.id}`)}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="holiday-calendars-page">
      <PageHeader
        title={t('holiday-calendars.title')}
        description={t('holiday-calendars.description')}
      >
        <PermissionButton
          requires="campaigns:calendar:manage"
          data-testid="holiday-calendars-create-btn"
          size="sm"
          onClick={() => {
            setEditingCalendar(null);
            setFormData({ name: '' });
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('holiday-calendars.create')}
        </PermissionButton>
      </PageHeader>

      {listContent}

      <ConfirmDeleteDialog
        open={deletingCalendar !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCalendar(null);
        }}
        onConfirm={() => {
          if (!deletingCalendar) return;
          deleteCalendar.mutate(deletingCalendar.id, {
            onSuccess: () => setDeletingCalendar(null),
          });
        }}
        entityName={deletingCalendar?.name ?? ''}
        entityType={t('holiday-calendars.entity_type')}
        isPending={deleteCalendar.isPending}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCalendar
                ? t('holiday-calendars.form.edit_title')
                : t('holiday-calendars.form.create_title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cal-name">{t('holiday-calendars.form.name')}</Label>
              <Input
                data-testid="calendar-form-name"
                id="cal-name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t('holiday-calendars.form.cancel')}
            </Button>
            <Button
              data-testid="calendar-form-submit"
              disabled={
                !formData.name.trim() || createCalendar.isPending || updateCalendar.isPending
              }
              onClick={() => {
                if (editingCalendar) {
                  updateCalendar.mutate(
                    { id: editingCalendar.id, ...formData },
                    { onSuccess: () => setFormOpen(false) },
                  );
                } else {
                  createCalendar.mutate(formData, { onSuccess: () => setFormOpen(false) });
                }
              }}
            >
              {createCalendar.isPending || updateCalendar.isPending
                ? t('holiday-calendars.form.saving')
                : editingCalendar
                  ? t('holiday-calendars.form.update')
                  : t('holiday-calendars.form.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
