import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password';
}

export const channelFields: Record<string, FieldDef[]> = {
  whatsapp: [
    { key: 'ApiToken', label: 'Business API Token', type: 'password' },
    { key: 'PhoneNumber', label: 'Phone Number', type: 'text' },
    { key: 'WebhookVerifyToken', label: 'Webhook Verify Token', type: 'text' },
  ],
  sms: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'SenderNumber', label: 'Sender Number', type: 'text' },
  ],
  email: [
    { key: 'SmtpHost', label: 'SMTP Host', type: 'text' },
    { key: 'SmtpPort', label: 'SMTP Port', type: 'text' },
    { key: 'SmtpUser', label: 'SMTP Username', type: 'text' },
    { key: 'SmtpPassword', label: 'SMTP Password', type: 'password' },
    { key: 'FromAddress', label: 'From Address', type: 'text' },
  ],
  webchat: [
    { key: 'WidgetKey', label: 'Widget Key', type: 'text' },
    { key: 'AllowedOrigins', label: 'Allowed Origins', type: 'text' },
  ],
  voice: [
    { key: 'TrunkHost', label: 'SIP Trunk Host', type: 'text' },
    { key: 'TrunkUser', label: 'Trunk Username', type: 'text' },
    { key: 'TrunkPassword', label: 'Trunk Password', type: 'password' },
    { key: 'CallerIdNumber', label: 'Caller ID Number', type: 'text' },
  ],
  messenger: [
    { key: 'PageAccessToken', label: 'Page Access Token', type: 'password' },
    { key: 'AppSecret', label: 'App Secret', type: 'password' },
    { key: 'VerifyToken', label: 'Verify Token', type: 'text' },
  ],
  instagram: [
    { key: 'AccessToken', label: 'Access Token', type: 'password' },
    { key: 'AppSecret', label: 'App Secret', type: 'password' },
  ],
  telegram: [
    { key: 'BotToken', label: 'Bot Token', type: 'password' },
    { key: 'WebhookUrl', label: 'Webhook URL', type: 'text' },
  ],
  twitter: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'BearerToken', label: 'Bearer Token', type: 'password' },
  ],
  video: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'RoomPrefix', label: 'Room Prefix', type: 'text' },
  ],
  rcs: [
    { key: 'AgentId', label: 'Agent ID', type: 'text' },
    { key: 'ServiceAccountKey', label: 'Service Account Key', type: 'password' },
  ],
};

export function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodType> = { isActive: z.boolean() };
  for (const field of fields) {
    shape[field.key] = z.string().min(1, 'admin:channels.validation.fieldRequired');
  }
  return z.object(shape);
}

interface ChannelConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
}

export function ChannelConfigForm({ open, onOpenChange, channelId }: ChannelConfigFormProps) {
  const { t } = useTranslation(['admin']);
  const updateChannel = useUpdateChannel();
  const fields = channelId ? (channelFields[channelId] ?? []) : [];
  const schema = useMemo(() => buildSchema(fields), [fields]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
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

  const isActive = watch('isActive') as boolean;

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

  const channelName = channelId
    ? channelId.charAt(0).toUpperCase() + channelId.slice(1)
    : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {channelName} {t('admin:channels.configuration')}
          </SheetTitle>
          <SheetDescription>
            {t('admin:channels.configDescription')}
          </SheetDescription>
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

export function buildDefaults(fields: FieldDef[]): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = { isActive: false };
  for (const field of fields) {
    defaults[field.key] = '';
  }
  return defaults;
}
