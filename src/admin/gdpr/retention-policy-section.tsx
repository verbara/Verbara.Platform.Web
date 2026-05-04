import { useEffect } from 'react';
import {
  useForm,
  Controller,
  type Control,
  type UseFormWatch,
  type UseFormSetValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Separator } from '@/core/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { useRetentionPolicy, useUpdateRetentionPolicy } from '@/core/api/hooks/use-gdpr';

const retentionSchema = z.object({
  conversationRetentionDays: z.number().min(1).max(3650).nullable(),
  authEventRetentionDays: z.number().min(1).max(3650).nullable(),
  auditRetentionDays: z.number().min(1).max(3650).nullable(),
  usageRecordRetentionDays: z.number().min(1).max(3650).nullable(),
});

type RetentionFormValues = z.infer<typeof retentionSchema>;

interface RetentionFieldConfig {
  name: keyof RetentionFormValues;
  i18nKey: string;
}

const RETENTION_FIELDS: RetentionFieldConfig[] = [
  { name: 'conversationRetentionDays', i18nKey: 'conversation' },
  { name: 'authEventRetentionDays', i18nKey: 'auth_event' },
  { name: 'auditRetentionDays', i18nKey: 'audit' },
  { name: 'usageRecordRetentionDays', i18nKey: 'usage' },
];

export interface RetentionPolicySectionProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RetentionPolicySection({
  tenantId,
  open,
  onOpenChange,
}: RetentionPolicySectionProps) {
  const { t } = useTranslation('admin');
  const { data: policy } = useRetentionPolicy(tenantId);
  const updatePolicy = useUpdateRetentionPolicy(tenantId);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<RetentionFormValues>({
    resolver: zodResolver(retentionSchema),
    defaultValues: {
      conversationRetentionDays: null,
      authEventRetentionDays: null,
      auditRetentionDays: null,
      usageRecordRetentionDays: null,
    },
  });

  useEffect(() => {
    if (open && policy) {
      reset({
        conversationRetentionDays: policy.conversationRetentionDays,
        authEventRetentionDays: policy.authEventRetentionDays,
        auditRetentionDays: policy.auditRetentionDays,
        usageRecordRetentionDays: policy.usageRecordRetentionDays,
      });
    }
  }, [open, policy, reset]);

  const onSubmit = handleSubmit((values) => {
    updatePolicy.mutate(values, {
      onSuccess: () => onOpenChange(false),
    });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md" data-testid="retention-sheet">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand" />
            <SheetTitle>{t('retention.policy.title')}</SheetTitle>
          </div>
          <SheetDescription>
            {t('retention.policy.description_prefix')}
            <span className="font-mono text-xs">{tenantId}</span>
            {t('retention.policy.description_suffix')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {RETENTION_FIELDS.map((field) => (
            <RetentionFieldRow
              key={field.name}
              config={field}
              control={control}
              watch={watch}
              setValue={setValue}
            />
          ))}

          <SheetFooter className="mt-auto px-0">
            <Button
              type="submit"
              disabled={isSubmitting || updatePolicy.isPending}
              data-testid="retention-save"
            >
              <Save className="mr-1.5 h-4 w-4" />
              {updatePolicy.isPending ? t('retention.policy.saving') : t('retention.policy.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

interface RetentionFieldRowProps {
  config: RetentionFieldConfig;
  control: Control<RetentionFormValues>;
  watch: UseFormWatch<RetentionFormValues>;
  setValue: UseFormSetValue<RetentionFormValues>;
}

function RetentionFieldRow({ config, control, watch, setValue }: RetentionFieldRowProps) {
  const { t } = useTranslation('admin');
  const value = watch(config.name);
  const enabled = value !== null;

  function handleToggle(checked: boolean) {
    setValue(config.name, checked ? 365 : null, { shouldValidate: true });
  }

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            {t(`retention.policy.fields.${config.i18nKey}.label`)}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(`retention.policy.fields.${config.i18nKey}.description`)}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {enabled && (
        <>
          <Separator />
          <div className="flex items-center gap-2">
            <Controller
              name={config.name}
              control={control}
              render={({ field, fieldState }) => (
                <div className="flex-1 space-y-1">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const num = e.target.value === '' ? null : Number(e.target.value);
                      field.onChange(num);
                    }}
                    placeholder={t('retention.policy.days_placeholder')}
                  />
                  {fieldState.error && (
                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />
            <span className="text-sm text-muted-foreground">
              {t('retention.policy.days_suffix')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
