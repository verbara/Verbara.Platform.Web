import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Textarea } from '@/core/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  useCreateReport,
  useUpdateReport,
  type ScheduledReport,
  type ReportType,
  type ReportFormat,
} from '@/core/api/hooks/use-reports';

const reportSchema = z.object({
  name: z.string().min(1, 'admin:reports.validation.nameRequired'),
  type: z.enum(['agent_performance', 'queue_analytics', 'conversation_summary'] as const),
  schedule: z.string().min(1, 'admin:reports.validation.scheduleRequired'),
  cronExpression: z.string().optional(),
  filters: z.string().optional(),
  recipients: z.string().optional(),
  format: z.enum(['CSV', 'PDF'] as const),
  isActive: z.boolean(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

interface ReportFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  report?: ScheduledReport;
}

const REPORT_TYPES: ReportType[] = ['agent_performance', 'queue_analytics', 'conversation_summary'];
const REPORT_FORMATS: ReportFormat[] = ['CSV', 'PDF'];
const REPORT_SCHEDULES: string[] = ['daily_8am', 'weekly_monday', 'monthly_1st', 'custom'];

const DEFAULT_VALUES: ReportFormValues = {
  name: '',
  type: 'agent_performance',
  schedule: 'daily_8am',
  cronExpression: '',
  filters: '',
  recipients: '',
  format: 'CSV',
  isActive: true,
};

function mapReportToForm(report: ScheduledReport): ReportFormValues {
  return {
    name: report.name,
    type: report.type,
    schedule: report.schedule,
    cronExpression: report.cronExpression ?? '',
    filters: report.filters ?? '',
    recipients: report.recipients ?? '',
    format: report.format,
    isActive: report.isActive,
  };
}

export function ReportForm({ open, onOpenChange, mode, report }: ReportFormProps) {
  const { t } = useTranslation(['admin']);
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const schedule = watch('schedule');

  useEffect(() => {
    if (open) {
      reset(report ? mapReportToForm(report) : DEFAULT_VALUES);
    }
  }, [open, report, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    const payload = {
      name: values.name,
      type: values.type,
      schedule: values.schedule,
      cronExpression: values.schedule === 'custom' ? values.cronExpression : undefined,
      filters: values.filters || undefined,
      recipients: values.recipients || undefined,
      format: values.format,
      isActive: values.isActive,
    };

    if (mode === 'edit' && report) {
      updateReport.mutate({ id: report.id, ...payload });
    } else {
      createReport.mutate(payload as Omit<ScheduledReport, 'id' | 'createdAt'>);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('admin:reports.create') : t('admin:reports.edit');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:reports.createDescription')
              : t('admin:reports.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="report-name">{t('admin:reports.name')}</Label>
            <Input
              id="report-name"
              placeholder={t('admin:reports.namePlaceholder')}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{t(errors.name.message ?? '')}</p>
            )}
          </div>

          {/* Report Type */}
          <div className="space-y-1.5">
            <Label>{t('admin:reports.type')}</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((rt) => (
                      <SelectItem key={rt} value={rt}>
                        {t(`admin:reports.type_${rt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label>{t('admin:reports.schedule')}</Label>
            <Controller
              name="schedule"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_SCHEDULES.map((rs) => (
                      <SelectItem key={rs} value={rs}>
                        {t(`admin:reports.schedule_${rs}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Custom Cron Expression */}
          {schedule === 'custom' && (
            <div className="space-y-1.5">
              <Label htmlFor="report-cron">{t('admin:reports.cronExpression')}</Label>
              <Input
                id="report-cron"
                placeholder={t('admin:reports.cronPlaceholder')}
                {...register('cronExpression')}
              />
              <p className="text-xs text-muted-foreground">{t('admin:reports.cronHint')}</p>
            </div>
          )}

          {/* Filters */}
          <div className="space-y-1.5">
            <Label htmlFor="report-filters">{t('admin:reports.filters')}</Label>
            <Input
              id="report-filters"
              placeholder={t('admin:reports.filtersPlaceholder')}
              {...register('filters')}
            />
            <p className="text-xs text-muted-foreground">{t('admin:reports.filtersHint')}</p>
          </div>

          {/* Recipients */}
          <div className="space-y-1.5">
            <Label htmlFor="report-recipients">{t('admin:reports.recipients')}</Label>
            <Textarea
              id="report-recipients"
              rows={3}
              placeholder={t('admin:reports.recipientsPlaceholder')}
              {...register('recipients')}
            />
            <p className="text-xs text-muted-foreground">{t('admin:reports.recipientsHint')}</p>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label>{t('admin:reports.format')}</Label>
            <Controller
              name="format"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_FORMATS.map((rf) => (
                      <SelectItem key={rf} value={rf}>
                        {rf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Active */}
          <div className="flex items-center gap-3">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  id="report-isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="report-isActive">{t('admin:reports.activeLabel')}</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:reports.create') : t('admin:reports.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
