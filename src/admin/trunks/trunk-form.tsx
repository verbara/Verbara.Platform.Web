import { useEffect } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Switch } from '@/core/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { useCreateTrunk, useUpdateTrunk, type TrunkSummary } from '@/core/api/hooks/use-trunks';

const TRUNK_TYPES = ['SIP', 'PJSIP', 'IAX2', 'DAHDI'] as const;

const trunkSchema = z.object({
  name: z.string().min(1, 'admin:trunks.validation.nameRequired'),
  displayName: z.string().min(1, 'admin:trunks.validation.displayNameRequired'),
  type: z.enum(['SIP', 'PJSIP', 'IAX2', 'DAHDI']),
  maxChannels: z.coerce.number().int().min(1, 'admin:trunks.validation.maxChannelsAtLeastOne'),
  isActive: z.boolean(),
});

export type TrunkFormValues = z.infer<typeof trunkSchema>;

interface TrunkFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  trunk?: TrunkSummary;
}

export function TrunkForm({ open, onOpenChange, mode, trunk }: TrunkFormProps) {
  const { t } = useTranslation('admin');
  const createTrunk = useCreateTrunk();
  const updateTrunk = useUpdateTrunk();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TrunkFormValues>({
    resolver: zodResolver(trunkSchema) as Resolver<TrunkFormValues>,
    defaultValues: {
      name: '',
      displayName: '',
      type: 'PJSIP',
      maxChannels: 10,
      isActive: true,
    },
  });

  const nameA11y = useFieldA11y(errors.name, 'trunk-name', { required: true });
  const displayNameA11y = useFieldA11y(errors.displayName, 'trunk-displayName', { required: true });
  const maxChannelsA11y = useFieldA11y(errors.maxChannels, 'trunk-maxChannels', { required: true });

  useEffect(() => {
    if (open) {
      reset(
        trunk
          ? {
              name: trunk.name,
              displayName: trunk.displayName,
              type: trunk.type as TrunkFormValues['type'],
              maxChannels: trunk.maxChannels,
              isActive: trunk.isActive,
            }
          : {
              name: '',
              displayName: '',
              type: 'PJSIP',
              maxChannels: 10,
              isActive: true,
            },
      );
    }
  }, [open, trunk, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    if (mode === 'edit' && trunk) {
      updateTrunk.mutate({ id: trunk.id, ...values });
    } else {
      createTrunk.mutate(values);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('trunks.form.create_title') : t('trunks.form.edit_title');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('trunks.form.create_description')
              : t('trunks.form.edit_description')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-name" required>
              {t('trunks.name')}
            </Label>
            <Input
              id="trunk-name"
              placeholder={t('trunks.form.name_placeholder')}
              data-testid="trunk-form-name"
              {...nameA11y.inputProps}
              {...register('name')}
            />
            <FieldError
              id={nameA11y.errorId}
              message={errors.name?.message ? t(errors.name.message) : undefined}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-displayName" required>
              {t('trunks.displayName')}
            </Label>
            <Input
              id="trunk-displayName"
              placeholder={t('trunks.form.display_name_placeholder')}
              data-testid="trunk-form-displayName"
              {...displayNameA11y.inputProps}
              {...register('displayName')}
            />
            <FieldError
              id={displayNameA11y.errorId}
              message={errors.displayName?.message ? t(errors.displayName.message) : undefined}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>{t('trunks.type')}</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="trunk-form-type">
                    <SelectValue placeholder={t('trunks.form.select_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUNK_TYPES.map((tt) => (
                      <SelectItem key={tt} value={tt}>
                        {tt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Max Channels */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-maxChannels" required>
              {t('trunks.maxChannels')}
            </Label>
            <Input
              id="trunk-maxChannels"
              type="number"
              min={1}
              placeholder="10"
              data-testid="trunk-form-maxChannels"
              {...maxChannelsA11y.inputProps}
              {...register('maxChannels')}
            />
            <FieldError
              id={maxChannelsA11y.errorId}
              message={errors.maxChannels?.message ? t(errors.maxChannels.message) : undefined}
            />
          </div>

          {/* Is Active */}
          <div className="flex items-center gap-3">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="trunk-isActive"
                  data-testid="trunk-form-isActive"
                />
              )}
            />
            <Label htmlFor="trunk-isActive">{t('trunks.form.active')}</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="trunk-form-submit">
              {mode === 'create' ? t('trunks.form.submit_create') : t('trunks.form.submit_edit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
