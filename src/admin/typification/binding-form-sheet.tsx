/* eslint-disable react-hooks/incompatible-library -- watch() drives the scope-conditional scopeRef field + the AI override section */
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { FieldError } from '@/core/ui/field-error';
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
  useCreateTypificationBinding,
  useUpdateTypificationBinding,
  type SchemaBinding,
  type TypificationSchema,
} from '@/core/api/hooks/use-typification';
import {
  bindingSchemaForm,
  BINDING_SCOPES,
  AI_MODES,
  type BindingFormValues,
} from './typification-schema';
import { aiConfigToForm, aiConfigFormToDto, defaultAiConfigForm } from './typification-mappers';

interface BindingFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binding?: SchemaBinding | null;
  schemas: TypificationSchema[];
}

const DEFAULT_VALUES: BindingFormValues = {
  scope: 'Tenant',
  scopeRef: '',
  schemaId: '',
  subtreeRootNodeId: '',
  priority: 0,
  aiOverrideEnabled: false,
  aiOverride: defaultAiConfigForm(),
};

function mapToForm(binding: SchemaBinding): BindingFormValues {
  return {
    scope: binding.scope,
    scopeRef: binding.scopeRef ?? '',
    schemaId: binding.schemaId,
    subtreeRootNodeId: binding.subtreeRootNodeId ?? '',
    priority: binding.priority,
    aiOverrideEnabled: !!binding.aiConfigOverride,
    // Hydrate an existing override with the SAME conversions the schema designer
    // uses (fractions→percents, Record→rows, PII filtered); else the default.
    aiOverride: binding.aiConfigOverride
      ? aiConfigToForm(binding.aiConfigOverride)
      : defaultAiConfigForm(),
  };
}

export function BindingFormSheet({ open, onOpenChange, binding, schemas }: BindingFormSheetProps) {
  const { t } = useTranslation(['admin']);
  const isEdit = !!binding;
  const createBinding = useCreateTypificationBinding();
  const updateBinding = useUpdateTypificationBinding();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<BindingFormValues>({
    resolver: zodResolver(bindingSchemaForm),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(binding ? mapToForm(binding) : DEFAULT_VALUES);
    }
  }, [open, binding, reset]);

  const scope = watch('scope');
  const isTenantScope = scope === 'Tenant';
  const aiOverrideEnabled = watch('aiOverrideEnabled');
  // The override seeds its carried PII/entity-map from the SELECTED schema on
  // enable, so gate the toggle until a schema is picked (else it would seed from
  // undefined → empty mask-all and never re-seed).
  const schemaSelected = !!watch('schemaId');

  /**
   * Seed-on-enable: when the admin turns the override ON and there is no existing
   * override yet, pre-fill it from the SELECTED schema's aiConfig so the pilot
   * starts from the schema baseline (PII/entityMap/thresholds) rather than blank.
   * An in-progress override (already enabled) is never clobbered.
   */
  function handleOverrideToggle(next: boolean): void {
    if (next && !binding?.aiConfigOverride) {
      const selected = schemas.find((s) => s.schemaId === getValues('schemaId'));
      setValue('aiOverride', aiConfigToForm(selected?.aiConfig), { shouldDirty: true });
    }
    setValue('aiOverrideEnabled', next, { shouldDirty: true });
  }

  const onSubmit = handleSubmit((values) => {
    const payload = {
      scope: values.scope,
      scopeRef: isTenantScope || !values.scopeRef?.trim() ? undefined : values.scopeRef.trim(),
      schemaId: values.schemaId,
      subtreeRootNodeId: values.subtreeRootNodeId?.trim()
        ? values.subtreeRootNodeId.trim()
        : undefined,
      priority: values.priority,
      // Per-binding AI override (E1). When ON, emit the FULL AiConfig (percents→
      // fractions, ALWAYS-emit entityFieldMap [Record] + piiAllowStore [array],
      // autonomous/dailyTokenBudget carried) via the shared helper so it matches
      // the schema designer exactly. When OFF, send undefined ⇒ inherit schema.
      //
      // The override is a SINGLE on/off control: when the section is ON we FORCE
      // `enabled: true` so no path ever emits an override with `enabled:false`
      // (which the server — a whole-object replace — would read as silently
      // disabling AI on a schema that had it on). "AI off for just this binding"
      // is expressed via Mode = Off, not via the enabled flag.
      aiConfigOverride: values.aiOverrideEnabled
        ? { ...aiConfigFormToDto(values.aiOverride), enabled: true }
        : undefined,
    };
    if (isEdit && binding) {
      updateBinding.mutate(
        { id: binding.bindingId, ...payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createBinding.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t('admin:typification.bindings.editTitle')
              : t('admin:typification.bindings.createTitle')}
          </SheetTitle>
          <SheetDescription>{t('admin:typification.bindings.description')}</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label>{t('admin:typification.bindings.scope')}</Label>
            <Controller
              control={control}
              name="scope"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="binding-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BINDING_SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`admin:typification.bindings.scopes.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="binding-scoperef">{t('admin:typification.bindings.scopeRef')}</Label>
            <Input
              id="binding-scoperef"
              disabled={isTenantScope}
              placeholder={
                isTenantScope
                  ? t('admin:typification.bindings.scopeRefTenant')
                  : t('admin:typification.bindings.scopeRefPlaceholder')
              }
              data-testid="binding-scoperef"
              {...register('scopeRef')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('admin:typification.bindings.schema')}</Label>
            <Controller
              control={control}
              name="schemaId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="binding-schema">
                    <SelectValue placeholder={t('admin:typification.bindings.schemaPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {schemas.map((s) => (
                      <SelectItem key={s.schemaId} value={s.schemaId}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              id="binding-schema-error"
              message={errors.schemaId?.message ? t(errors.schemaId.message) : undefined}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="binding-subtree">{t('admin:typification.bindings.subtreeRoot')}</Label>
            <Input
              id="binding-subtree"
              placeholder={t('admin:typification.bindings.subtreeRootPlaceholder')}
              data-testid="binding-subtree"
              {...register('subtreeRootNodeId')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="binding-priority">{t('admin:typification.bindings.priority')}</Label>
            <Input
              id="binding-priority"
              type="number"
              className="w-32"
              data-testid="binding-priority"
              {...register('priority', { valueAsNumber: true })}
            />
          </div>

          {/* Per-binding AI config override (E1) — the pilot lever. */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <Label>{t('admin:typification.bindings.aiOverride.title')}</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin:typification.bindings.aiOverride.hint')}
            </p>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="aiOverrideEnabled"
                render={({ field: f }) => (
                  <Switch
                    checked={f.value}
                    onCheckedChange={handleOverrideToggle}
                    disabled={!schemaSelected}
                    data-testid="binding-ai-override-toggle"
                  />
                )}
              />
              <Label className="text-xs">
                {t('admin:typification.bindings.aiOverride.enable')}
              </Label>
            </div>
            {!schemaSelected && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="binding-ai-override-select-schema"
              >
                {t('admin:typification.bindings.aiOverride.selectSchemaFirst')}
              </p>
            )}

            {aiOverrideEnabled && (
              <div className="space-y-3" data-testid="binding-ai-override">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="binding-ai-override-mode">
                    {t('admin:typification.bindings.aiOverride.mode')}
                  </Label>
                  <select
                    id="binding-ai-override-mode"
                    data-testid="binding-ai-override-mode"
                    className="h-9 w-full max-w-xs rounded-lg border border-input bg-background px-2.5 text-sm"
                    {...register('aiOverride.mode')}
                  >
                    {AI_MODES.map((m) => (
                      <option key={m} value={m}>
                        {t(`admin:typification.ai.modes.${m}`)}
                      </option>
                    ))}
                  </select>
                  {/* The override is always active when the section is ON; "AI off
                      for just this binding" is expressed via Mode = Off. */}
                  <p className="text-xs text-muted-foreground">
                    {t('admin:typification.bindings.aiOverride.modeOffHint')}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="binding-ai-override-suggest-threshold">
                    {t('admin:typification.bindings.aiOverride.suggestThreshold')}
                  </Label>
                  <Input
                    id="binding-ai-override-suggest-threshold"
                    type="number"
                    min={0}
                    max={100}
                    className="w-32"
                    data-testid="binding-ai-override-suggest-threshold"
                    {...register('aiOverride.suggestThresholdPercent', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="binding-ai-override-autoapply-threshold">
                    {t('admin:typification.bindings.aiOverride.autoApplyThreshold')}
                  </Label>
                  <Input
                    id="binding-ai-override-autoapply-threshold"
                    type="number"
                    min={0}
                    max={100}
                    className="w-32"
                    data-testid="binding-ai-override-autoapply-threshold"
                    {...register('aiOverride.autoApplyThresholdPercent', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="binding-ai-override-autonomous-threshold">
                    {t('admin:typification.bindings.aiOverride.autonomousThreshold')}
                  </Label>
                  <Input
                    id="binding-ai-override-autonomous-threshold"
                    type="number"
                    min={0}
                    max={100}
                    className="w-32"
                    data-testid="binding-ai-override-autonomous-threshold"
                    {...register('aiOverride.autonomousThresholdPercent', { valueAsNumber: true })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name="aiOverride.sentimentGating"
                    render={({ field: f }) => (
                      <Switch
                        checked={f.value}
                        onCheckedChange={f.onChange}
                        data-testid="binding-ai-override-sentiment-gating"
                      />
                    )}
                  />
                  <Label className="text-xs">
                    {t('admin:typification.bindings.aiOverride.sentimentGating')}
                  </Label>
                </div>

                {/* The override's PII allow-list + entity map are CARRIED from the
                    selected schema's config (seeded on enable, round-tripped on
                    edit) and are edited in the schema designer, NOT here. */}
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="binding-ai-override-inherit-note"
                >
                  {t('admin:typification.bindings.aiOverride.inheritNote')}
                </p>
              </div>
            )}
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button
              type="submit"
              disabled={createBinding.isPending || updateBinding.isPending}
              data-testid="binding-submit"
            >
              {isEdit
                ? t('admin:typification.bindings.save')
                : t('admin:typification.bindings.create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
