/* eslint-disable react-hooks/incompatible-library -- RHF watch() subscription + useFormContext patterns */
import { useEffect, useMemo } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MessageSquare,
  Smartphone,
  Mail,
  Globe,
  Phone,
  MessagesSquare,
  Camera,
  Send,
  X,
  Video,
  MessageCircle,
} from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { ChannelTestButton } from '@/admin/channels/channel-test-button';
import { CredentialField } from '@/admin/channels/credential-field';
import {
  channelFields,
  buildSchema,
  buildDefaults,
  buildCredentialUpdate,
  type FieldDef,
} from '@/admin/channels/channel-fields';
import type { SetupFormValues } from '../setup-wizard';

const CHANNELS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare },
  { id: 'sms', name: 'SMS', icon: Smartphone },
  { id: 'email', name: 'Email', icon: Mail },
  { id: 'webchat', name: 'WebChat', icon: Globe },
  { id: 'voice', name: 'Voice', icon: Phone },
  { id: 'messenger', name: 'Messenger', icon: MessagesSquare },
  { id: 'instagram', name: 'Instagram', icon: Camera },
  { id: 'telegram', name: 'Telegram', icon: Send },
  { id: 'twitter', name: 'Twitter', icon: X },
  { id: 'video', name: 'Video', icon: Video },
  { id: 'rcs', name: 'RCS', icon: MessageCircle },
];

function ChannelConfigFields({
  channelId,
  fields,
  wizardSetValue,
}: {
  channelId: string;
  fields: FieldDef[];
  wizardSetValue: (name: 'channelConfig', value: Record<string, string>) => void;
}) {
  const { t } = useTranslation(['admin']);
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const defaults = useMemo(() => buildDefaults(fields), [fields]);

  const {
    register,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  // Sync local form values to wizard form's channelConfig
  useEffect(() => {
    const subscription = watch((values) => {
      // Only the keys the admin filled: Platform keeps what is stored for a key it is not sent.
      const config: Record<string, string> = {};
      for (const [key, val] of Object.entries(buildCredentialUpdate(fields, values))) {
        if (typeof val === 'string') config[key] = val;
      }
      wizardSetValue('channelConfig', config);
    });
    return () => subscription.unsubscribe();
  }, [watch, fields, wizardSetValue]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">
        {t('admin:setup.channelConfigure', 'Configure credentials')}
      </h3>

      {fields.map((field) => (
        <CredentialField
          key={field.key}
          field={field}
          registration={register(field.key)}
          error={errors[field.key] as { message?: string } | undefined}
        />
      ))}

      <ChannelTestButton channelId={channelId} />
    </div>
  );
}

export default function ChannelStep() {
  const { t } = useTranslation(['admin']);
  const { watch, setValue } = useFormContext<SetupFormValues>();
  const selectedChannelId = watch('channelId');
  const fields = selectedChannelId ? (channelFields[selectedChannelId] ?? []) : [];

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t('admin:setup.channelTitle', 'Select a Channel')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'admin:setup.channelDescription',
            'Choose the communication channel to connect first.',
          )}
        </p>
      </div>

      {/* Channel selection grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const isSelected = selectedChannelId === channel.id;
          const isRecommended = channel.id === 'webchat';

          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => setValue('channelId', channel.id)}
              className={`relative flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
            >
              {isRecommended && (
                <Badge className="absolute -top-2 right-1 text-[10px]">
                  {t('admin:setup.channelRecommended', 'Recommended')}
                </Badge>
              )}
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium">{channel.name}</span>
            </button>
          );
        })}
      </div>

      {/* Channel configuration */}
      {selectedChannelId && fields.length > 0 && (
        <ChannelConfigFields
          key={selectedChannelId}
          channelId={selectedChannelId}
          fields={fields}
          wizardSetValue={setValue}
        />
      )}
    </div>
  );
}
