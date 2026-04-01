import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
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
  name: z.string().min(1, 'Name is required'),
  endpointUrl: z.string().url('Must be a valid URL').refine((v) => v.startsWith('https://'), 'Must use HTTPS'),
  eventTypes: z.array(z.string()).min(1, 'Select at least one event type'),
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
  const isEdit = !!subscription;
  const createSubscription = useCreateWebhookSubscription();
  const updateSubscription = useUpdateWebhookSubscription();
  const { data: eventTypes = [] } = useWebhookEventTypes();

  const [secretDialog, setSecretDialog] = useState(false);
  const [createdSecret, setCreatedSecret] = useState('');
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema) as any,
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(subscription ? mapToForm(subscription) : DEFAULT_VALUES);
    }
  }, [open, subscription, reset]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [createdSecret]);

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
            <SheetTitle>{isEdit ? 'Edit subscription' : 'Create subscription'}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update webhook subscription settings.'
                : 'Configure a new webhook endpoint to receive events.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                data-testid="webhook-form-name"
                placeholder="My webhook"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                data-testid="webhook-form-url"
                placeholder="https://example.com/webhook"
                {...register('endpointUrl')}
              />
              {errors.endpointUrl && (
                <p className="text-xs text-destructive">{errors.endpointUrl.message}</p>
              )}
            </div>

            {isEdit && (
              <div className="flex items-center gap-3">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="wh-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="wh-active">Active</Label>
              </div>
            )}

            <div className="space-y-3">
              <Label>Event types</Label>
              {errors.eventTypes && (
                <p className="text-xs text-destructive">
                  {typeof errors.eventTypes.message === 'string'
                    ? errors.eventTypes.message
                    : 'Select at least one event type'}
                </p>
              )}

              {eventTypes.length === 0 && (
                <p className="text-sm text-muted-foreground">Loading event types...</p>
              )}

              <Controller
                name="eventTypes"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {eventTypes.map((et) => {
                      const checked = field.value.includes(et.eventType);
                      return (
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
                                field.onChange(field.value.filter((v: string) => v !== et.eventType));
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{et.eventType}</span>
                            <p className="truncate text-xs text-muted-foreground">{et.description}</p>
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
                {isEdit ? 'Save' : 'Create'}
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
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Webhook secret</DialogTitle>
            <DialogDescription>
              Copy your signing secret now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {createdSecret}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400">
            This secret is used to verify webhook payloads via HMAC-SHA256. Store it securely.
          </p>

          <DialogFooter>
            <Button onClick={() => setSecretDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
