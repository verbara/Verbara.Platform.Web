import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { ChannelTestButton } from './channel-test-button';
import { useUpdateChannel } from '@/core/api/hooks/use-channels';
import { channelFields, buildSchema, buildDefaults } from './channel-fields';
export type { FieldDef } from './channel-fields';

interface ChannelConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
}

export function ChannelConfigForm({ open, onOpenChange, channelId }: ChannelConfigFormProps) {
  const { t } = useTranslation(['admin']);
  const updateChannel = useUpdateChannel();
  const fields = useMemo(() => (channelId ? (channelFields[channelId] ?? []) : []), [channelId]);
  const schema = useMemo(() => buildSchema(fields), [fields]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(fields),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaults(fields));
    }
  }, [open, fields, reset]);

  const isActive = useWatch({ control, name: 'isActive' }) as boolean;

  const handleFormSubmit = handleSubmit((values) => {
    if (!channelId) return;
    const { isActive, ...rest } = values;
    const credentials: Record<string, string> = {};
    for (const [key, val] of Object.entries(rest)) {
      if (typeof val === 'string') credentials[key] = val;
    }
    updateChannel.mutate(
      { channelId, isActive: isActive as boolean, credentials },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  const channelName = channelId ? channelId.charAt(0).toUpperCase() + channelId.slice(1) : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {channelName} {t('admin:channels.configuration')}
          </SheetTitle>
          <SheetDescription>{t('admin:channels.configDescription')}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 px-4">
          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">{t('admin:channels.enabled')}</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setValue('isActive', checked)}
            />
          </div>

          {/* Dynamic credential fields */}
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type}
                aria-invalid={!!errors[field.key]}
                {...register(field.key)}
              />
              {errors[field.key] && (
                <p className="text-xs text-destructive">
                  {t(String(errors[field.key]?.message ?? ''), { field: field.label })}
                </p>
              )}
            </div>
          ))}

          <SheetFooter className="mt-auto flex-row gap-2 px-0">
            {channelId && <ChannelTestButton channelId={channelId} />}
            <Button type="submit" disabled={isSubmitting || updateChannel.isPending}>
              {t('admin:channels.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
