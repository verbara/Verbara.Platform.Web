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
import type { UseFormRegister, FieldValues } from 'react-hook-form';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { ChannelTestButton } from '@/admin/channels/channel-test-button';
import {
  channelFields,
  buildSchema,
  buildDefaults,
  type FieldDef,
} from '@/admin/channels/channel-fields';
import type { SetupFormValues } from '../setup-wizard';

interface ChannelConfigFieldProps {
  readonly field: FieldDef;
  readonly register: UseFormRegister<FieldValues>;
  readonly error: { message?: string } | undefined;
}

function ChannelConfigField({ field, register, error }: ChannelConfigFieldProps) {
  const a11y = useFieldA11y(error, `channel-${field.key}`, { required: true });
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`channel-${field.key}`} required>
        {field.label}
      </Label>
      <Input
        id={`channel-${field.key}`}
        type={field.type}
        {...a11y.inputProps}
        {...register(field.key)}
      />
      <FieldError id={a11y.errorId} message={error?.message?.toString()} />
    </div>
  );
}

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
      const config: Record<string, string> = {};
      for (const field of fields) {
        const val = values[field.key];
        if (typeof val === 'string') {
          config[field.key] = val;
        }
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
        <ChannelConfigField
          key={field.key}
          field={field}
          register={register}
          error={errors[field.key]}
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
