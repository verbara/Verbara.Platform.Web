import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Checkbox } from '@/core/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
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
import { useQueues } from '@/core/api/hooks/use-queues';

// NOTE: The form previously included "Schedule" (per-day hours) and
// "Disposition codes" tabs and a timezone selector. Those fields were
// submitted to /admin/queues but the backend silently dropped them — the
// Queue aggregate has a `Hours` field but it isn't wired through the API,
// dispositions are a tenant-wide concept (see /admin/dispositions), and
// agent assignment happens via /admin/queue-members. Those tabs are gone
// so the form reflects the actual contract. Re-adding them is future
// feature work that must include backend persistence (tracked in roadmap).

const queueSchema = z.object({
  name: z.string().min(1, 'admin:queues.validation.nameRequired'),
  isActive: z.boolean(),
  maxWaiting: z.string(),
  answerWithinSeconds: z.string(),
  firstResponseWithinSeconds: z.string(),
  resolutionWithinSeconds: z.string(),
  overflowQueueId: z.string().optional(),
  overflowAfterSeconds: z.string(),
  requiredSkills: z.array(z.object({ name: z.string().min(1) })),
  defaultWrapUpSeconds: z.string(),
  forceWrapUp: z.boolean(),
});

export type QueueFormValues = z.infer<typeof queueSchema>;

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
  const { data: allQueues = [] } = useQueues();

  const defaults: QueueFormValues = {
    name: '',
    isActive: true,
    maxWaiting: '',
    answerWithinSeconds: '',
    firstResponseWithinSeconds: '',
    resolutionWithinSeconds: '',
    overflowQueueId: '',
    overflowAfterSeconds: '',
    requiredSkills: [],
    defaultWrapUpSeconds: '30',
    forceWrapUp: false,
    ...defaultValues,
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QueueFormValues>({
    resolver: zodResolver(queueSchema),
    defaultValues: defaults,
  });

  const nameA11y = useFieldA11y(errors.name, 'queue-name', { required: true });

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({ control, name: 'requiredSkills' });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        reset(defaults);
        setSkillInput('');
      }
      onOpenChange(nextOpen);
    },
    // defaults is reconstructed each render but its contents come from
    // defaultValues (stable prop) — include it to satisfy exhaustive-deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reset, onOpenChange],
  );

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

  const otherQueues = allQueues.filter((q) => {
    if (mode === 'edit' && defaultValues?.name) {
      return q.name !== defaultValues.name;
    }
    return true;
  });

  const title = mode === 'create' ? t('admin:queues.create') : t('admin:queues.edit');

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:queues.createDescription')
              : t('admin:queues.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general">{t('admin:queues.general')}</TabsTrigger>
              <TabsTrigger value="sla">{t('admin:queues.sla')}</TabsTrigger>
              <TabsTrigger value="routing">{t('admin:queues.routing')}</TabsTrigger>
              <TabsTrigger value="wrapup">{t('admin:queues.wrap_up')}</TabsTrigger>
            </TabsList>

            {/* Tab 1: General */}
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="queue-name" required>
                  {t('admin:queues.name')}
                </Label>
                <Input
                  id="queue-name"
                  data-testid="queue-form-name"
                  placeholder={t('admin:queues.namePlaceholder')}
                  {...nameA11y.inputProps}
                  {...register('name')}
                />
                <FieldError
                  id={nameA11y.errorId}
                  message={errors.name?.message ? t(errors.name.message) : undefined}
                />
              </div>

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

              <div className="flex items-center gap-2">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label>{t('admin:queues.active')}</Label>
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
                <Label htmlFor="firstResponseWithinSeconds">
                  {t('admin:queues.firstResponseWithin')}
                </Label>
                <Input
                  id="firstResponseWithinSeconds"
                  type="number"
                  min={1}
                  placeholder="60"
                  {...register('firstResponseWithinSeconds')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resolutionWithinSeconds">
                  {t('admin:queues.resolutionWithin')}
                </Label>
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

            {/* Tab 4: Wrap-up */}
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
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label>{t('admin:queues.forceWrapUp')}</Label>
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" data-testid="queue-form-submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:queues.create') : t('admin:queues.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
