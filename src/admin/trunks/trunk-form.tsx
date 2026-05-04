import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
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
    resolver: zodResolver(trunkSchema),
    defaultValues: {
      name: '',
      displayName: '',
      type: 'PJSIP',
      maxChannels: 10,
      isActive: true,
    },
  });

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
            <Label htmlFor="trunk-name">{t('trunks.name')}</Label>
            <Input
              id="trunk-name"
              placeholder={t('trunks.form.name_placeholder')}
              aria-invalid={!!errors.name}
              data-testid="trunk-form-name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{t(errors.name.message ?? '')}</p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-displayName">{t('trunks.displayName')}</Label>
            <Input
              id="trunk-displayName"
              placeholder={t('trunks.form.display_name_placeholder')}
              aria-invalid={!!errors.displayName}
              data-testid="trunk-form-displayName"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">{t(errors.displayName.message ?? '')}</p>
            )}
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
            <Label htmlFor="trunk-maxChannels">{t('trunks.maxChannels')}</Label>
            <Input
              id="trunk-maxChannels"
              type="number"
              min={1}
              placeholder="10"
              aria-invalid={!!errors.maxChannels}
              data-testid="trunk-form-maxChannels"
              {...register('maxChannels')}
            />
            {errors.maxChannels && (
              <p className="text-xs text-destructive">{t(errors.maxChannels.message ?? '')}</p>
            )}
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
