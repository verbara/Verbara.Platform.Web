import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
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
