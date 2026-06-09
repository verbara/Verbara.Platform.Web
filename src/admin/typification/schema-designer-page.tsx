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
} from '@/core/api/hooks/use-typification';
import { typificationSchemaForm, type TypificationSchemaFormValues } from './typification-schema';
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
  // The mode is not editable in P2a, but we DISPLAY the actual persisted mode
  // (round-tripped by schemaToForm) so editing an out-of-band AutoApply schema
  // never misleadingly shows "SuggestOnly".
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
              {/* Mode — read-only in P2a. Displays the ACTUAL persisted mode so
                  an out-of-band AutoApply schema is shown correctly (editing it
                  here preserves the mode via schemaToForm round-trip). */}
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.ai.mode')}</Label>
                <select
                  disabled
                  value={aiMode}
                  data-testid="ai-config-mode"
                  className="h-9 w-full max-w-xs rounded-lg border border-input bg-muted px-2.5 text-sm text-muted-foreground"
                >
                  <option value={aiMode}>{t(`admin:typification.ai.modes.${aiMode}`)}</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {aiMode === 'AutoApplyAboveThreshold'
                    ? t('admin:typification.ai.modeHintAutoApply')
                    : t('admin:typification.ai.modeHint')}
                </p>
              </div>

              {/* Confidence threshold (percent). */}
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="ai-config-threshold">
                  {t('admin:typification.ai.threshold')}
                </Label>
                <Input
                  id="ai-config-threshold"
                  type="number"
                  min={0}
                  max={100}
                  className="w-32"
                  data-testid="ai-config-threshold"
                  {...register('aiConfig.confidenceThresholdPercent', { valueAsNumber: true })}
                />
                {errors.aiConfig?.confidenceThresholdPercent?.message && (
                  <p className="text-xs text-destructive">
                    {t(errors.aiConfig.confidenceThresholdPercent.message)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin:typification.ai.thresholdHint')}
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
