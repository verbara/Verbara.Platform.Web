import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Checkbox } from '@/core/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import { Separator } from '@/core/ui/separator';
import { MOCK_QUEUES } from './queues-page';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Bogota',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Lima',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Berlin',
  'UTC',
] as const;

const scheduleEntrySchema = z.object({
  day: z.string(),
  open: z.string(),
  close: z.string(),
  enabled: z.boolean(),
});

const dispositionSchema = z.object({
  code: z.string().min(1, 'Code is required'),
});

const queueSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean(),
  maxWaiting: z.string(),
  timezone: z.string().optional(),
  answerWithinSeconds: z.string(),
  firstResponseWithinSeconds: z.string(),
  resolutionWithinSeconds: z.string(),
  overflowQueueId: z.string().optional(),
  overflowAfterSeconds: z.string(),
  requiredSkills: z.array(z.object({ name: z.string().min(1) })),
  schedule: z.array(scheduleEntrySchema),
  defaultWrapUpSeconds: z.string(),
  forceWrapUp: z.boolean(),
  dispositions: z.array(dispositionSchema),
});

export type QueueFormValues = z.infer<typeof queueSchema>;

const defaultSchedule = DAYS.map((day) => ({
  day,
  open: '08:00',
  close: '18:00',
  enabled: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day),
}));

interface QueueFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: Partial<QueueFormValues>;
  onSubmit?: (values: QueueFormValues) => void;
}

export function QueueForm({ open, onOpenChange, mode, defaultValues, onSubmit }: QueueFormProps) {
  const { t } = useTranslation(['admin']);
  const [skillInput, setSkillInput] = useState('');

  const defaults: QueueFormValues = {
    name: '',
    isActive: true,
    maxWaiting: '',
    timezone: '',
    answerWithinSeconds: '',
    firstResponseWithinSeconds: '',
    resolutionWithinSeconds: '',
    overflowQueueId: '',
    overflowAfterSeconds: '',
    requiredSkills: [],
    schedule: defaultSchedule,
    defaultWrapUpSeconds: '30',
    forceWrapUp: false,
    dispositions: [],
    ...defaultValues,
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<QueueFormValues>({
    resolver: zodResolver(queueSchema),
    defaultValues: defaults,
  });

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({ control, name: 'requiredSkills' });

  const {
    fields: dispositionFields,
    append: appendDisposition,
    remove: removeDisposition,
    move: moveDisposition,
  } = useFieldArray({ control, name: 'dispositions' });

  const schedule = watch('schedule');

  useEffect(() => {
    if (open) {
      reset(defaults);
      setSkillInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    onSubmit?.(values);
    onOpenChange(false);
  });

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skillFields.some((f) => f.name === trimmed)) {
      appendSkill({ name: trimmed });
      setSkillInput('');
    }
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const otherQueues = MOCK_QUEUES.filter((q) => {
    if (mode === 'edit' && defaultValues?.name) {
      return q.name !== defaultValues.name;
    }
    return true;
  });

  const title = mode === 'create' ? t('admin:queues.create') : t('admin:queues.edit');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:queues.createDescription')
              : t('admin:queues.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general">{t('admin:queues.general')}</TabsTrigger>
              <TabsTrigger value="sla">{t('admin:queues.sla')}</TabsTrigger>
              <TabsTrigger value="routing">{t('admin:queues.routing')}</TabsTrigger>
              <TabsTrigger value="schedule">{t('admin:queues.hours')}</TabsTrigger>
              <TabsTrigger value="wrapup">{t('admin:queues.wrap_up')}</TabsTrigger>
            </TabsList>

            {/* Tab 1: General */}
            <TabsContent value="general" className="space-y-4 pt-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">{t('admin:queues.name')}</Label>
                <Input
                  id="name"
                  placeholder="Support"
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Max Waiting */}
              <div className="space-y-1.5">
                <Label htmlFor="maxWaiting">{t('admin:queues.maxWaiting')}</Label>
                <Input
                  id="maxWaiting"
                  type="number"
                  min={1}
                  placeholder="20"
                  {...register('maxWaiting')}
                />
              </div>

              {/* Is Active */}
              <div className="flex items-center gap-2">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label>{t('admin:queues.active')}</Label>
              </div>

              {/* Timezone */}
              <div className="space-y-1.5">
                <Label>{t('admin:queues.timezone')}</Label>
                <Controller
                  name="timezone"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('admin:queues.selectTimezone')} />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </TabsContent>

            {/* Tab 2: SLA */}
            <TabsContent value="sla" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="answerWithinSeconds">{t('admin:queues.answerWithin')}</Label>
                <Input
                  id="answerWithinSeconds"
                  type="number"
                  min={1}
                  placeholder="30"
                  {...register('answerWithinSeconds')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="firstResponseWithinSeconds">{t('admin:queues.firstResponseWithin')}</Label>
                <Input
                  id="firstResponseWithinSeconds"
                  type="number"
                  min={1}
                  placeholder="60"
                  {...register('firstResponseWithinSeconds')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resolutionWithinSeconds">{t('admin:queues.resolutionWithin')}</Label>
                <Input
                  id="resolutionWithinSeconds"
                  type="number"
                  min={1}
                  placeholder="3600"
                  {...register('resolutionWithinSeconds')}
                />
              </div>
            </TabsContent>

            {/* Tab 3: Routing */}
            <TabsContent value="routing" className="space-y-4 pt-4">
              {/* Required Skills */}
              <div className="space-y-2">
                <Label>{t('admin:queues.skills')}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('admin:queues.addSkillPlaceholder')}
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skillFields.map((field, index) => (
                    <span
                      key={field.id}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"
                    >
                      {field.name}
                      <button
                        type="button"
                        onClick={() => removeSkill(index)}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {skillFields.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t('admin:queues.noSkills')}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Overflow */}
              <div className="space-y-1.5">
                <Label>{t('admin:queues.overflowQueue')}</Label>
                <Controller
                  name="overflowQueueId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('admin:queues.noOverflow')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('admin:queues.noOverflow')}</SelectItem>
                        {otherQueues.map((q) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="overflowAfterSeconds">{t('admin:queues.overflowAfter')}</Label>
                <Input
                  id="overflowAfterSeconds"
                  type="number"
                  min={1}
                  placeholder="120"
                  {...register('overflowAfterSeconds')}
                />
              </div>
            </TabsContent>

            {/* Tab 4: Schedule */}
            <TabsContent value="schedule" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">{t('admin:queues.scheduleDescription')}</p>
              {schedule?.map((entry, index) => (
                <div key={entry.day} className="flex items-center gap-2">
                  <Controller
                    name={`schedule.${index}.enabled`}
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <span className="w-24 text-sm font-medium">{entry.day}</span>
                  <Input
                    type="time"
                    className="w-28"
                    disabled={!entry.enabled}
                    {...register(`schedule.${index}.open`)}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="w-28"
                    disabled={!entry.enabled}
                    {...register(`schedule.${index}.close`)}
                  />
                </div>
              ))}
            </TabsContent>

            {/* Tab 5: Wrap-up */}
            <TabsContent value="wrapup" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="defaultWrapUpSeconds">{t('admin:queues.wrapUpSeconds')}</Label>
                <Input
                  id="defaultWrapUpSeconds"
                  type="number"
                  min={1}
                  placeholder="30"
                  {...register('defaultWrapUpSeconds')}
                />
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  name="forceWrapUp"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label>{t('admin:queues.forceWrapUp')}</Label>
              </div>

              <Separator />

              {/* Disposition codes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('admin:queues.dispositionCodes')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendDisposition({ code: '' })}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {t('admin:queues.addDisposition')}
                  </Button>
                </div>
                {dispositionFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    <Input
                      placeholder={t('admin:queues.dispositionPlaceholder')}
                      aria-invalid={!!errors.dispositions?.[index]?.code}
                      {...register(`dispositions.${index}.code`)}
                      className="flex-1"
                    />
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => moveDisposition(index, index - 1)}
                        title="Move up"
                      >
                        &uarr;
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeDisposition(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {dispositionFields.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('admin:queues.noDispositions')}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:queues.create') : t('admin:queues.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
