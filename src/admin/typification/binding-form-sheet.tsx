/* eslint-disable react-hooks/incompatible-library -- watch() drives the scope-conditional scopeRef field */
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
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
import { bindingSchemaForm, BINDING_SCOPES, type BindingFormValues } from './typification-schema';

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
};

function mapToForm(binding: SchemaBinding): BindingFormValues {
  return {
    scope: binding.scope,
    scopeRef: binding.scopeRef ?? '',
    schemaId: binding.schemaId,
    subtreeRootNodeId: binding.subtreeRootNodeId ?? '',
    priority: binding.priority,
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

  const onSubmit = handleSubmit((values) => {
    const payload = {
      scope: values.scope,
      scopeRef: isTenantScope || !values.scopeRef?.trim() ? undefined : values.scopeRef.trim(),
      schemaId: values.schemaId,
      subtreeRootNodeId: values.subtreeRootNodeId?.trim()
        ? values.subtreeRootNodeId.trim()
        : undefined,
      priority: values.priority,
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
