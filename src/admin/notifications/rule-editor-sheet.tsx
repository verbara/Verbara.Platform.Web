import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  useCreateNotificationRule,
  useUpdateNotificationRule,
  useNotificationEventTypes,
  type NotificationRule,
} from '@/core/api/hooks/use-notification-rules';
import {
  notificationRuleSchema,
  type NotificationRuleFormValues,
} from './notification-rule-schema';
import { RulePreviewCard } from './rule-preview-card';

const CHANNELS = ['Email', 'SMS', 'Push', 'Webhook', 'InApp'] as const;
const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'] as const;
const SCHEDULE_MODES = ['always', 'business_hours', 'custom'] as const;

interface RuleEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: NotificationRule | null;
}

const DEFAULT_VALUES: NotificationRuleFormValues = {
  name: '',
  description: '',
  eventType: '',
  subConditions: {},
  conditions: [],
  actions: [{ channel: 'Email', config: {} }],
  schedule: { mode: 'always' },
  throttling: { maxPerPeriod: 10, periodUnit: 'hour', cooldownMinutes: 5 },
};

function mapToForm(rule: NotificationRule): NotificationRuleFormValues {
  return {
    name: rule.name,
    description: rule.description ?? '',
    eventType: rule.trigger.eventType,
    subConditions: rule.trigger.subConditions,
    conditions: rule.conditions,
    actions: rule.actions,
    schedule: rule.schedule,
    throttling: rule.throttling,
  };
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b pb-4">
      <button
        type="button"
        className="flex w-full items-center justify-between py-2 text-sm font-medium"
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
}

export function RuleEditorSheet({ open, onOpenChange, rule }: RuleEditorSheetProps) {
  const { t } = useTranslation('admin');
  const isEdit = !!rule;
  const createRule = useCreateNotificationRule();
  const updateRule = useUpdateNotificationRule();
  const { data: eventTypes = [] } = useNotificationEventTypes();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<NotificationRuleFormValues>({
    resolver: zodResolver(notificationRuleSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const {
    fields: conditionFields,
    append: appendCondition,
    remove: removeCondition,
  } = useFieldArray({ control, name: 'conditions' });

  const {
    fields: actionFields,
    append: appendAction,
    remove: removeAction,
  } = useFieldArray({ control, name: 'actions' });

  useEffect(() => {
    if (open) {
      reset(rule ? mapToForm(rule) : DEFAULT_VALUES);
    }
  }, [open, rule, reset]);

  const scheduleMode = watch('schedule.mode');

  function onSubmit(data: NotificationRuleFormValues) {
    if (isEdit && rule) {
      updateRule.mutate(
        {
          id: rule.ruleId,
          data: {
            name: data.name,
            description: data.description,
            trigger: { eventType: data.eventType, subConditions: data.subConditions ?? {} },
            conditions: data.conditions,
            actions: data.actions,
            schedule: data.schedule,
            throttling: data.throttling,
          },
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createRule.mutate(
        {
          name: data.name,
          description: data.description,
          trigger: { eventType: data.eventType, subConditions: data.subConditions ?? {} },
          conditions: data.conditions,
          actions: data.actions,
          schedule: data.schedule,
          throttling: data.throttling,
        } as unknown as Omit<
          NotificationRule,
          | 'ruleId'
          | 'tenantId'
          | 'createdAt'
          | 'updatedAt'
          | 'lastFiredAt'
          | 'state'
          | 'channels'
          | 'severity'
          | 'recipients'
          | 'eventType'
        >,
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t('notifications.rules.form.editTitle')
              : t('notifications.rules.form.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? t('notifications.rules.form.editDescription')
              : t('notifications.rules.form.createDescription')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">{t('notifications.rules.form.name')}</Label>
            <Input
              id="rule-name"
              placeholder={t('notifications.rules.form.namePlaceholder')}
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{t(errors.name.message!)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-desc">{t('notifications.rules.form.description')}</Label>
            <Input
              id="rule-desc"
              placeholder={t('notifications.rules.form.descriptionPlaceholder')}
              {...register('description')}
            />
          </div>

          {/* Section 1: Trigger */}
          <CollapsibleSection title={t('notifications.rules.form.sections.trigger')}>
            <Label>{t('notifications.rules.form.trigger.eventType')}</Label>
            <Controller
              control={control}
              name="eventType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('notifications.rules.form.trigger.eventTypePlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((et) => (
                      <SelectItem key={et.eventType} value={et.eventType}>
                        {et.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.eventType && (
              <p className="text-sm text-destructive">{t(errors.eventType.message!)}</p>
            )}
          </CollapsibleSection>

          {/* Section 2: Conditions */}
          <CollapsibleSection
            title={t('notifications.rules.form.sections.conditions')}
            defaultOpen={conditionFields.length > 0}
          >
            {conditionFields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('notifications.rules.form.conditions.empty')}
              </p>
            )}
            {conditionFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={t('notifications.rules.form.conditions.fieldPlaceholder')}
                  {...register(`conditions.${index}.field`)}
                  className="flex-1"
                />
                <Controller
                  control={control}
                  name={`conditions.${index}.operator`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op} value={op}>
                            {op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Input
                  placeholder={t('notifications.rules.form.conditions.valuePlaceholder')}
                  {...register(`conditions.${index}.value`)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => removeCondition(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendCondition({ field: '', operator: 'eq', value: '' })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('notifications.rules.form.conditions.add')}
            </Button>
          </CollapsibleSection>

          {/* Section 3: Actions */}
          <CollapsibleSection title={t('notifications.rules.form.sections.actions')}>
            {actionFields.map((field, index) => (
              <div key={field.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Controller
                    control={control}
                    name={`actions.${index}.channel`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((ch) => (
                            <SelectItem key={ch} value={ch}>
                              {t(`notifications.rules.channels.${ch}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {actionFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeAction(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Input
                  placeholder={t('notifications.rules.form.actions.recipientsPlaceholder')}
                  {...register(`actions.${index}.config.recipients` as `actions.${number}.config`)}
                />
                <Input
                  placeholder={t('notifications.rules.form.actions.templatePlaceholder')}
                  {...register(`actions.${index}.config.template` as `actions.${number}.config`)}
                />
              </div>
            ))}
            {errors.actions && (
              <p className="text-sm text-destructive">{t(errors.actions.message!)}</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendAction({ channel: 'Email', config: {} })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('notifications.rules.form.actions.title')}
            </Button>
          </CollapsibleSection>

          {/* Section 4: Schedule */}
          <CollapsibleSection
            title={t('notifications.rules.form.sections.schedule')}
            defaultOpen={false}
          >
            <Label>{t('notifications.rules.form.schedule.mode')}</Label>
            <Controller
              control={control}
              name="schedule.mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(
                          `notifications.rules.form.schedule.${m === 'business_hours' ? 'businessHours' : m}`,
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {scheduleMode === 'custom' && (
              <div className="mt-2 space-y-2">
                <Label>{t('notifications.rules.form.schedule.timezone')}</Label>
                <Input {...register('schedule.timezone')} placeholder="UTC" />
              </div>
            )}
          </CollapsibleSection>

          {/* Section 5: Throttling */}
          <CollapsibleSection
            title={t('notifications.rules.form.sections.throttling')}
            defaultOpen={false}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label>{t('notifications.rules.form.throttling.maxPerPeriod')}</Label>
                <Input
                  type="number"
                  min={1}
                  {...register('throttling.maxPerPeriod', { valueAsNumber: true })}
                />
              </div>
              <div className="w-28">
                <Label>{t('notifications.rules.form.throttling.period')}</Label>
                <Controller
                  control={control}
                  name="throttling.periodUnit"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hour">
                          {t('notifications.rules.form.throttling.hour')}
                        </SelectItem>
                        <SelectItem value="day">
                          {t('notifications.rules.form.throttling.day')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div>
              <Label>{t('notifications.rules.form.throttling.cooldown')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  {...register('throttling.cooldownMinutes', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">
                  {t('notifications.rules.form.throttling.cooldownMinutes')}
                </span>
              </div>
            </div>
          </CollapsibleSection>

          {/* Preview */}
          {isEdit && rule && <RulePreviewCard ruleId={rule.ruleId} />}

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('notifications.rules.form.cancel')}
            </Button>
            <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>
              {isEdit ? t('notifications.rules.form.save') : t('notifications.rules.form.create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
