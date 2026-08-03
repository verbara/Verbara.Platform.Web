import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { CopyButton } from '@/core/ui/copy-button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Switch } from '@/core/ui/switch';
import { Checkbox } from '@/core/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui/dialog';
import {
  useCreateWebhookSubscription,
  useUpdateWebhookSubscription,
  useWebhookEventTypes,
  type WebhookSubscription,
} from '@/core/api/hooks/use-webhooks';

const webhookSchema = z.object({
  name: z.string().min(1, 'admin:webhooks.validation.nameRequired'),
  endpointUrl: z
    .string()
    .url('admin:webhooks.validation.urlInvalid')
    .refine((v) => v.startsWith('https://'), 'admin:webhooks.validation.urlMustHttps'),
  eventTypes: z.array(z.string()).min(1, 'admin:webhooks.validation.eventTypesRequired'),
  isActive: z.boolean(),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

interface WebhookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: WebhookSubscription | null;
}

const DEFAULT_VALUES: WebhookFormValues = {
  name: '',
  endpointUrl: '',
  eventTypes: [],
  isActive: true,
};

function mapToForm(sub: WebhookSubscription): WebhookFormValues {
  return {
    name: sub.name,
    endpointUrl: sub.endpointUrl,
    eventTypes: [...sub.eventTypes],
    isActive: sub.isActive,
  };
}

export function WebhookForm({ open, onOpenChange, subscription }: WebhookFormProps) {
  const { t } = useTranslation('admin');
  const isEdit = !!subscription;
  const createSubscription = useCreateWebhookSubscription();
  const updateSubscription = useUpdateWebhookSubscription();
  const { data: eventTypes = [] } = useWebhookEventTypes();

  const [secretDialog, setSecretDialog] = useState(false);
  const [createdSecret, setCreatedSecret] = useState('');

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const nameA11y = useFieldA11y(errors.name, 'wh-name', { required: true });
  const urlA11y = useFieldA11y(errors.endpointUrl, 'wh-url', { required: true });

  useEffect(() => {
    if (open) {
      reset(subscription ? mapToForm(subscription) : DEFAULT_VALUES);
    }
  }, [open, subscription, reset]);

  const onSubmit = handleSubmit((values) => {
    if (isEdit && subscription) {
      updateSubscription.mutate({
        id: subscription.subscriptionId,
        data: {
          name: values.name,
          endpointUrl: values.endpointUrl,
          eventTypes: values.eventTypes,
          isActive: values.isActive,
        },
      });
      onOpenChange(false);
    } else {
      createSubscription.mutate(
        {
          name: values.name,
          endpointUrl: values.endpointUrl,
          eventTypes: values.eventTypes,
        },
        {
          onSuccess: (data) => {
            setCreatedSecret(data.secret);
            setSecretDialog(true);
            onOpenChange(false);
          },
        },
      );
    }
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {isEdit ? t('webhooks.form.edit_title') : t('webhooks.form.create_title')}
            </SheetTitle>
            <SheetDescription>
              {isEdit ? t('webhooks.form.edit_description') : t('webhooks.form.create_description')}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-name" required>
                {t('webhooks.form.name')}
              </Label>
              <Input
                id="wh-name"
                data-testid="webhook-form-name"
                placeholder={t('webhooks.form.name_placeholder')}
                {...nameA11y.inputProps}
                {...register('name')}
              />
              <FieldError
                id={nameA11y.errorId}
                message={errors.name?.message ? t(errors.name.message) : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wh-url" required>
                {t('webhooks.form.endpoint_url')}
              </Label>
              <Input
                id="wh-url"
                data-testid="webhook-form-url"
                placeholder={t('webhooks.form.endpoint_url_placeholder')}
                {...urlA11y.inputProps}
                {...register('endpointUrl')}
              />
              {errors.endpointUrl && (
                <p
                  id={urlA11y.errorId}
                  role="alert"
                  data-testid="webhook-form-url-error"
                  className="text-xs text-destructive"
                >
                  {t(errors.endpointUrl.message ?? '')}
                </p>
              )}
            </div>

            {isEdit && (
              <div className="flex items-center gap-3">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch id="wh-active" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="wh-active">{t('webhooks.form.active')}</Label>
              </div>
            )}

            <div className="space-y-3">
              <Label>{t('webhooks.form.event_types')}</Label>
              {errors.eventTypes && (
                <p className="text-xs text-destructive">
                  {typeof errors.eventTypes.message === 'string'
                    ? t(errors.eventTypes.message)
                    : t('webhooks.form.event_types_required')}
                </p>
              )}

              {eventTypes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('webhooks.form.event_types_loading')}
                </p>
              )}

              <Controller
                name="eventTypes"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {eventTypes.map((et) => {
                      const checked = field.value.includes(et.eventType);
                      return (
                        // eslint-disable-next-line jsx-a11y/label-has-associated-control -- label wraps Checkbox; implicit association via nesting
                        <label
                          key={et.eventType}
                          className="flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50"
                          title={et.description}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              if (c) {
                                field.onChange([...field.value, et.eventType]);
                              } else {
                                field.onChange(
                                  field.value.filter((v: string) => v !== et.eventType),
                                );
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{et.eventType}</span>
                            <p className="truncate text-xs text-muted-foreground">
                              {et.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            <SheetFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting} data-testid="webhook-form-submit">
                {isEdit ? t('webhooks.form.save') : t('webhooks.form.create')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={secretDialog}
        onOpenChange={(o) => {
          setSecretDialog(o);
          if (!o) {
            setCreatedSecret('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="webhook-secret-dialog">
          <DialogHeader>
            <DialogTitle>{t('webhooks.form.secret_dialog.title')}</DialogTitle>
            <DialogDescription>{t('webhooks.form.secret_dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {createdSecret}
            </code>
            <CopyButton value={createdSecret} variant="outline" iconOnly />
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('webhooks.form.secret_dialog.warning')}
          </p>

          <DialogFooter>
            <Button onClick={() => setSecretDialog(false)}>
              {t('webhooks.form.secret_dialog.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
