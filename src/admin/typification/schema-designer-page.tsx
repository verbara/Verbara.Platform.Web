import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Send, Sparkles } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
import { Switch } from '@/core/ui/switch';
import { FieldError } from '@/core/ui/field-error';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/admin/shared/page-header';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import {
  useTypificationSchema,
  useCreateTypificationSchema,
  useUpdateTypificationSchema,
  usePublishTypificationSchema,
  useCalibrationStatus,
} from '@/core/api/hooks/use-typification';
import {
  typificationSchemaForm,
  AI_MODES,
  type TypificationSchemaFormValues,
} from './typification-schema';
import {
  DEFAULT_FORM_VALUES,
  emptyNode,
  emptyField,
  formToInput,
  schemaToForm,
} from './typification-mappers';
import { NodesEditor } from './nodes-editor';
import { FieldsEditor } from './fields-editor';
import { PublishErrorsDialog } from './publish-errors-dialog';

export default function SchemaDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['admin']);

  const isNew = !id || id === 'new';
  const { data: schema, isLoading } = useTypificationSchema(isNew ? undefined : id);
  const { data: calibration } = useCalibrationStatus(isNew ? undefined : id);
  const autoFillReady = calibration?.autoFillReady ?? false;
  const autonomousReady = calibration?.autonomousReady ?? false;

  const createSchema = useCreateTypificationSchema();
  const updateSchema = useUpdateTypificationSchema();
  const publishSchema = usePublishTypificationSchema();

  const [publishErrorsOpen, setPublishErrorsOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TypificationSchemaFormValues>({
    resolver: zodResolver(typificationSchemaForm),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const {
    fields: nodeFields,
    append: appendNode,
    remove: removeNode,
  } = useFieldArray({ control, name: 'nodes' });

  const {
    fields: fieldFields,
    append: appendField,
    remove: removeField,
  } = useFieldArray({ control, name: 'fields' });

  useEffect(() => {
    if (!isNew && schema) {
      reset(schemaToForm(schema));
    }
  }, [isNew, schema, reset]);

  const nameA11y = useFieldA11y(errors.name, 'schema-name', { required: true });

  const aiEnabled = watch('aiConfig.enabled');
  // Currently-selected mode — used to keep a persisted AutoFill mode selectable
  // even when calibration has not yet unlocked the AutoFill option.
  const aiMode = watch('aiConfig.mode');

  const addNode = useCallback(() => {
    appendNode(emptyNode(nodeFields.length));
  }, [appendNode, nodeFields.length]);

  const addField = useCallback(() => {
    appendField(emptyField(fieldFields.length));
  }, [appendField, fieldFields.length]);

  const onSubmit = handleSubmit((values) => {
    const input = formToInput(values);
    if (isNew) {
      createSchema.mutate(input, {
        onSuccess: (created) => navigate(`/admin/typification/${created.schemaId}`),
      });
    } else if (id) {
      updateSchema.mutate({ id, ...input });
    }
  });

  const onPublish = useCallback(() => {
    if (isNew || !id) return;
    publishSchema.mutate(id, {
      onSuccess: (result) => {
        if (!result.ok) setPublishErrorsOpen(true);
      },
    });
  }, [id, isNew, publishSchema]);

  if (!isNew && isLoading) {
    return <PageSkeleton />;
  }

  const saving = createSchema.isPending || updateSchema.isPending;

  return (
    <div className="space-y-6" data-testid="schema-designer-page">
      <PageHeader
        title={
          isNew
            ? t('admin:typification.designer.newTitle')
            : t('admin:typification.designer.editTitle')
        }
        description={t('admin:typification.designer.description')}
      >
        <Button
          variant="outline"
          onClick={() => navigate('/admin/typification')}
          data-testid="designer-back-btn"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t('admin:typification.designer.back')}
        </Button>
        {!isNew && schema && (
          <Badge variant={schema.isPublished ? 'default' : 'outline'}>
            {schema.isPublished ? t('admin:typification.published') : t('admin:typification.draft')}
          </Badge>
        )}
      </PageHeader>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Basic */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="schema-name" required>
              {t('admin:typification.designer.name')}
            </Label>
            <Input
              id="schema-name"
              placeholder={t('admin:typification.designer.namePlaceholder')}
              data-testid="schema-name"
              {...nameA11y.inputProps}
              {...register('name')}
            />
            <FieldError
              id={nameA11y.errorId}
              message={errors.name?.message ? t(errors.name.message) : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="schema-maxdepth">{t('admin:typification.designer.maxDepth')}</Label>
            <Input
              id="schema-maxdepth"
              type="number"
              min={1}
              max={8}
              className="w-32"
              data-testid="schema-maxdepth"
              {...register('maxDepth', { valueAsNumber: true })}
            />
            {errors.maxDepth?.message && (
              <p className="text-xs text-destructive">{t(errors.maxDepth.message)}</p>
            )}
          </div>
        </div>

        {/* Nodes */}
        <div className="rounded-lg border p-4">
          <NodesEditor
            control={control}
            register={register}
            watch={watch}
            errors={errors}
            fields={nodeFields}
            onAdd={addNode}
            onRemove={removeNode}
          />
        </div>

        {/* Fields */}
        <div className="rounded-lg border p-4">
          <FieldsEditor
            control={control}
            register={register}
            watch={watch}
            errors={errors}
            fields={fieldFields}
            onAdd={addField}
            onRemove={removeField}
          />
        </div>

        {/* AI auto-disposition */}
        <div className="space-y-3 rounded-lg border p-4" data-testid="ai-config-section">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label>{t('admin:typification.ai.title')}</Label>
          </div>
          <p className="text-xs text-muted-foreground">{t('admin:typification.ai.hint')}</p>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="aiConfig.enabled"
              render={({ field: f }) => (
                <Switch
                  checked={f.value}
                  onCheckedChange={f.onChange}
                  data-testid="ai-config-enabled"
                />
              )}
            />
            <Label className="text-xs">{t('admin:typification.ai.enable')}</Label>
          </div>

          {aiEnabled && (
            <div className="space-y-3" data-testid="ai-config-editor">
              {/* Mode — editable in P2b. The AutoFill option is locked until the
                  schema reaches the calibration bar, but a persisted AutoFill
                  mode stays selectable so an already-promoted schema isn't
                  silently demoted on edit. */}
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="ai-config-mode">
                  {t('admin:typification.ai.mode')}
                </Label>
                <select
                  id="ai-config-mode"
                  data-testid="ai-config-mode"
                  className="h-9 w-full max-w-xs rounded-lg border border-input bg-background px-2.5 text-sm"
                  {...register('aiConfig.mode')}
                >
                  {AI_MODES.map((m) => (
                    <option
                      key={m}
                      value={m}
                      disabled={m === 'AutoFill' && !autoFillReady && aiMode !== 'AutoFill'}
                    >
                      {t(`admin:typification.ai.modes.${m}`)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {t('admin:typification.ai.modeHint')}
                </p>
                {!autoFillReady && aiMode !== 'AutoFill' && (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="ai-config-autofill-hint"
                  >
                    {t('admin:typification.ai.autoFillLockedHint')}
                  </p>
                )}
              </div>

              {/* Graduated confidence bands (percents). */}
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="ai-config-suggest-threshold">
                  {t('admin:typification.ai.suggestThreshold')}
                </Label>
                <Input
                  id="ai-config-suggest-threshold"
                  type="number"
                  min={0}
                  max={100}
                  className="w-32"
                  data-testid="ai-config-suggest-threshold"
                  {...register('aiConfig.suggestThresholdPercent', { valueAsNumber: true })}
                />
                {errors.aiConfig?.suggestThresholdPercent?.message && (
                  <p className="text-xs text-destructive">
                    {t(errors.aiConfig.suggestThresholdPercent.message)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin:typification.ai.suggestThresholdHint')}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="ai-config-autoapply-threshold">
                  {t('admin:typification.ai.autoApplyThreshold')}
                </Label>
                <Input
                  id="ai-config-autoapply-threshold"
                  type="number"
                  min={0}
                  max={100}
                  className="w-32"
                  data-testid="ai-config-autoapply-threshold"
                  {...register('aiConfig.autoApplyThresholdPercent', { valueAsNumber: true })}
                />
                {errors.aiConfig?.autoApplyThresholdPercent?.message && (
                  <p className="text-xs text-destructive">
                    {t(errors.aiConfig.autoApplyThresholdPercent.message)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin:typification.ai.autoApplyThresholdHint')}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="ai-config-autonomous-threshold">
                  {t('admin:typification.ai.autonomousThreshold')}
                </Label>
                <Input
                  id="ai-config-autonomous-threshold"
                  type="number"
                  min={0}
                  max={100}
                  className="w-32"
                  data-testid="ai-config-autonomous-threshold"
                  {...register('aiConfig.autonomousThresholdPercent', { valueAsNumber: true })}
                />
                {errors.aiConfig?.autonomousThresholdPercent?.message && (
                  <p className="text-xs text-destructive">
                    {t(errors.aiConfig.autonomousThresholdPercent.message)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin:typification.ai.autonomousThresholdHint')}
                </p>
              </div>

              {/* Sentiment gating. */}
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="aiConfig.sentimentGating"
                  render={({ field: f }) => (
                    <Switch
                      checked={f.value}
                      onCheckedChange={f.onChange}
                      data-testid="ai-config-sentiment-gating"
                    />
                  )}
                />
                <Label className="text-xs">{t('admin:typification.ai.sentimentGating')}</Label>
              </div>
            </div>
          )}

          {/* Calibration status panel — existing schemas only. */}
          {!isNew && (
            <div
              className="space-y-2 rounded-md border bg-muted/40 p-3"
              data-testid="ai-calibration-panel"
            >
              <Label className="text-xs font-medium">
                {t('admin:typification.ai.calibration.title')}
              </Label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t('admin:typification.ai.calibration.samples')}: {calibration?.samples ?? 0}
                </span>
                <span>
                  {t('admin:typification.ai.calibration.accuracy')}:{' '}
                  {Math.round((calibration?.accuracy ?? 0) * 100)}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={autoFillReady ? 'default' : 'outline'}
                  data-testid="ai-calibration-autofill-ready"
                >
                  {autoFillReady
                    ? t('admin:typification.ai.calibration.autoFillReady')
                    : t('admin:typification.ai.calibration.autoFillNotReady')}
                </Badge>
                <Badge
                  variant={autonomousReady ? 'default' : 'outline'}
                  data-testid="ai-calibration-autonomous-ready"
                >
                  {autonomousReady
                    ? t('admin:typification.ai.calibration.autonomousReady')
                    : t('admin:typification.ai.calibration.autonomousNotReady')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('admin:typification.ai.calibration.hint')}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving} data-testid="designer-save-btn">
            <Save className="mr-1.5 h-4 w-4" />
            {t('admin:typification.designer.save')}
          </Button>
          {!isNew && (
            <Button
              type="button"
              variant="secondary"
              onClick={onPublish}
              disabled={publishSchema.isPending}
              data-testid="designer-publish-btn"
            >
              <Send className="mr-1.5 h-4 w-4" />
              {t('admin:typification.designer.publish')}
            </Button>
          )}
        </div>
      </form>

      <PublishErrorsDialog
        open={publishErrorsOpen}
        onOpenChange={setPublishErrorsOpen}
        schemaName={schema?.name ?? ''}
        errors={publishSchema.data?.errors ?? []}
      />
    </div>
  );
}
