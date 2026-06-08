import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useFieldArray } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormWatch, FieldErrors } from 'react-hook-form';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { FIELD_TYPES, CONDITION_REF_TYPES, CONDITION_OPS } from './typification-schema';
import { NONE_VALUE } from './typification-mappers';
import type { TypificationSchemaFormValues } from './typification-schema';

interface FieldsEditorProps {
  control: Control<TypificationSchemaFormValues>;
  register: UseFormRegister<TypificationSchemaFormValues>;
  watch: UseFormWatch<TypificationSchemaFormValues>;
  errors: FieldErrors<TypificationSchemaFormValues>;
  fields: { id: string }[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function FieldsEditor({
  control,
  register,
  watch,
  errors,
  fields,
  onAdd,
  onRemove,
}: FieldsEditorProps) {
  const { t } = useTranslation(['admin']);

  return (
    <div className="space-y-3" data-testid="fields-editor">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t('admin:typification.fields.title')}</Label>
          <p className="text-xs text-muted-foreground">{t('admin:typification.fields.hint')}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAdd}
          data-testid="add-field-btn"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('admin:typification.fields.add')}
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('admin:typification.fields.empty')}</p>
      )}

      {fields.map((field, index) => (
        <FieldRow
          key={field.id}
          index={index}
          control={control}
          register={register}
          watch={watch}
          errors={errors}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}

interface FieldRowProps {
  index: number;
  control: Control<TypificationSchemaFormValues>;
  register: UseFormRegister<TypificationSchemaFormValues>;
  watch: UseFormWatch<TypificationSchemaFormValues>;
  errors: FieldErrors<TypificationSchemaFormValues>;
  onRemove: () => void;
}

function FieldRow({ index, control, register, watch, errors, onRemove }: FieldRowProps) {
  const { t } = useTranslation(['admin']);
  const [validationOpen, setValidationOpen] = useState(false);

  const type = watch(`fields.${index}.type`);
  const visibleWhenEnabled = watch(`fields.${index}.visibleWhen.enabled`);
  const nodes = watch('nodes');
  const supportsOptions = type === 'Select' || type === 'MultiSelect';
  const fieldErrors = errors.fields?.[index];

  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption,
  } = useFieldArray({ control, name: `fields.${index}.options` });

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3" data-testid={`field-row-${index}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('admin:typification.fields.fieldN', { n: index + 1 })}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          data-testid={`remove-field-${index}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('admin:typification.fields.key')}</Label>
          <Input
            placeholder={t('admin:typification.fields.keyPlaceholder')}
            data-testid={`field-key-${index}`}
            {...register(`fields.${index}.key`)}
          />
          {fieldErrors?.key && (
            <p className="text-xs text-destructive">{t(fieldErrors.key.message ?? '')}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('admin:typification.fields.label')}</Label>
          <Input
            placeholder={t('admin:typification.fields.labelPlaceholder')}
            data-testid={`field-label-${index}`}
            {...register(`fields.${index}.label`)}
          />
          {fieldErrors?.label && (
            <p className="text-xs text-destructive">{t(fieldErrors.label.message ?? '')}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('admin:typification.fields.type')}</Label>
          <Controller
            control={control}
            name={`fields.${index}.type`}
            render={({ field: f }) => (
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger className="w-full" data-testid={`field-type-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {t(`admin:typification.fieldTypes.${ft}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('admin:typification.fields.attachTo')}</Label>
          <Controller
            control={control}
            name={`fields.${index}.attachToNodeId`}
            render={({ field: f }) => (
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger className="w-full" data-testid={`field-attach-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    {t('admin:typification.fields.attachNone')}
                  </SelectItem>
                  {nodes?.map((n) => (
                    <SelectItem key={n.nodeId} value={n.nodeId}>
                      {n.label || n.code || n.nodeId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={`fields.${index}.required`}
          render={({ field: f }) => (
            <Switch
              checked={f.value}
              onCheckedChange={f.onChange}
              data-testid={`field-required-${index}`}
            />
          )}
        />
        <Label className="text-xs">{t('admin:typification.fields.required')}</Label>
      </div>

      {/* Options (Select / MultiSelect only) */}
      {supportsOptions && (
        <div className="space-y-2 rounded-md border border-dashed bg-background p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('admin:typification.fields.options')}</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => appendOption({ value: '', label: '' })}
              data-testid={`add-option-${index}`}
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('admin:typification.fields.addOption')}
            </Button>
          </div>
          {optionFields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t('admin:typification.fields.noOptions')}
            </p>
          )}
          {optionFields.map((opt, optIdx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder={t('admin:typification.fields.optionValue')}
                data-testid={`option-value-${index}-${optIdx}`}
                {...register(`fields.${index}.options.${optIdx}.value`)}
              />
              <Input
                className="flex-1"
                placeholder={t('admin:typification.fields.optionLabel')}
                data-testid={`option-label-${index}-${optIdx}`}
                {...register(`fields.${index}.options.${optIdx}.label`)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => removeOption(optIdx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Validation (collapsible) */}
      <div className="rounded-md border border-dashed bg-background">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
          onClick={() => setValidationOpen((o) => !o)}
          data-testid={`field-validation-toggle-${index}`}
        >
          {t('admin:typification.fields.validation')}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${validationOpen ? '' : '-rotate-90'}`}
          />
        </button>
        {validationOpen && (
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">{t('admin:typification.fields.regex')}</Label>
              <Input
                placeholder={t('admin:typification.fields.regexPlaceholder')}
                {...register(`fields.${index}.regex`)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('admin:typification.fields.min')}</Label>
              <Input
                type="number"
                {...register(`fields.${index}.min`, {
                  setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('admin:typification.fields.max')}</Label>
              <Input
                type="number"
                {...register(`fields.${index}.max`, {
                  setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('admin:typification.fields.maxLength')}</Label>
              <Input
                type="number"
                {...register(`fields.${index}.maxLength`, {
                  setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                })}
              />
            </div>
          </div>
        )}
      </div>

      {/* visibleWhen condition */}
      <div className="space-y-2 rounded-md border border-dashed bg-background p-3">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name={`fields.${index}.visibleWhen.enabled`}
            render={({ field: f }) => (
              <Switch
                checked={f.value}
                onCheckedChange={f.onChange}
                data-testid={`field-visiblewhen-toggle-${index}`}
              />
            )}
          />
          <Label className="text-xs">{t('admin:typification.conditions.visibleWhen')}</Label>
        </div>

        {visibleWhenEnabled && (
          <div className="space-y-2" data-testid={`field-visiblewhen-editor-${index}`}>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.conditions.refType')}</Label>
                <Controller
                  control={control}
                  name={`fields.${index}.visibleWhen.refType`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger
                        className="w-full"
                        data-testid={`field-visiblewhen-reftype-${index}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_REF_TYPES.map((rt) => (
                          <SelectItem key={rt} value={rt}>
                            {t(`admin:typification.conditions.refTypes.${rt}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.conditions.op')}</Label>
                <Controller
                  control={control}
                  name={`fields.${index}.visibleWhen.op`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger
                        className="w-full"
                        data-testid={`field-visiblewhen-op-${index}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPS.map((op) => (
                          <SelectItem key={op} value={op}>
                            {t(`admin:typification.conditions.ops.${op}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.conditions.ref')}</Label>
                <Input
                  placeholder={t('admin:typification.conditions.refPlaceholder')}
                  data-testid={`field-visiblewhen-ref-${index}`}
                  {...register(`fields.${index}.visibleWhen.ref`)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.conditions.value')}</Label>
                <Input
                  placeholder={t('admin:typification.conditions.valuePlaceholder')}
                  data-testid={`field-visiblewhen-value-${index}`}
                  {...register(`fields.${index}.visibleWhen.value`)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
