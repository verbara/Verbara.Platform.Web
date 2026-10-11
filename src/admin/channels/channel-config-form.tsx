import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useForm,
  useWatch,
  type FieldError as RHFFieldError,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/core/ui/button';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { CopyButton } from '@/core/ui/copy-button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { ChannelTestButton } from './channel-test-button';
import { CredentialField, CredentialRemoveButton, CredentialStatusBadge } from './credential-field';
import { useChannel, useUpdateChannel, type ChannelConfig } from '@/core/api/hooks/use-channels';
import {
  channelFields,
  buildSchema,
  buildDefaults,
  buildCredentialUpdate,
  legacyKeysOf,
  webhookUrlFor,
} from './channel-fields';
export type { FieldDef } from './channel-fields';

interface ChannelConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
}

type FormValues = Record<string, string | boolean>;

/** The tenant every request of this tab names (the impersonated one during an impersonation). */
function useRequestTenantId(): string | null {
  const impersonated = useAuthStore((s) =>
    s.impersonation?.active ? s.impersonation.targetTenantId : null,
  );
  const active = useTenantStore((s) => s.activeTenantId);
  const own = useAuthStore((s) => s.tenantId);
  return impersonated ?? active ?? own;
}

function WebhookUrl({ url }: Readonly<{ url: string }>) {
  const { t } = useTranslation(['admin']);
  return (
    <div className="space-y-1.5">
      <Label>{t('admin:channels.webhook.label')}</Label>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
        <code className="flex-1 break-all font-mono text-xs" data-channel-webhook-url>
          {url}
        </code>
        <CopyButton value={url} variant="ghost" size="sm" iconOnly />
      </div>
      <p className="text-xs text-muted-foreground">{t('admin:channels.webhook.help')}</p>
    </div>
  );
}

function LegacyCredentials({
  keys,
  removed,
  onToggle,
}: Readonly<{ keys: string[]; removed: ReadonlySet<string>; onToggle: (key: string) => void }>) {
  const { t } = useTranslation(['admin']);
  return (
    <section className="space-y-2 rounded-lg border border-dashed p-3" data-legacy-credentials>
      <h3 className="text-sm font-medium">{t('admin:channels.legacy.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('admin:channels.legacy.help')}</p>
      <ul className="space-y-1">
        {keys.map((key) => (
          <li
            key={key}
            className="flex items-center justify-between gap-2 text-sm"
            data-legacy-credential={key}
            data-removed={removed.has(key) ? 'true' : 'false'}
          >
            <span className={`font-mono text-xs ${removed.has(key) ? 'line-through' : ''}`}>
              {key}
            </span>
            <span className="flex items-center gap-1">
              {removed.has(key) ? (
                <span className="text-xs text-destructive">
                  {t('admin:channels.credential.willBeRemoved')}
                </span>
              ) : (
                <CredentialStatusBadge credentialKey={key} isSet />
              )}
              <CredentialRemoveButton
                credentialKey={key}
                removed={removed.has(key)}
                onToggle={() => onToggle(key)}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChannelConfigForm({ open, onOpenChange, channelId }: ChannelConfigFormProps) {
  const { t } = useTranslation(['admin']);
  const { data: config, isLoading } = useChannel(open && channelId ? channelId : undefined);
  const channelName = channelId ? channelId.charAt(0).toUpperCase() + channelId.slice(1) : '';
  // The form body starts over whenever the stored state it was built from changes (a load, a save
  // elsewhere) or the sheet reopens; a refetch that changes nothing keeps what the admin typed.
  const stateKey = config
    ? `${config.isActive}|${config.credentials.map((c) => `${c.key}:${c.isSet}`).join(',')}`
    : 'unknown';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {channelName} {t('admin:channels.configuration')}
          </SheetTitle>
          <SheetDescription>{t('admin:channels.configDescription')}</SheetDescription>
        </SheetHeader>
        {channelId && (
          <ChannelConfigBody
            key={`${open}|${channelId}|${stateKey}`}
            channelId={channelId}
            config={config}
            loading={isLoading}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChannelConfigBody({
  channelId,
  config,
  loading,
  onSaved,
}: Readonly<{
  channelId: string;
  config: ChannelConfig | undefined;
  loading: boolean;
  onSaved: () => void;
}>) {
  const { t } = useTranslation(['admin']);
  const updateChannel = useUpdateChannel();
  const tenantId = useRequestTenantId();
  const fields = useMemo(() => channelFields[channelId] ?? [], [channelId]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());

  // Platform reports every key as `{key, isSet}`; `undefined` while the configuration is not known.
  const setKeys = useMemo(
    () => (config ? new Map(config.credentials.map((c) => [c.key, c.isSet] as const)) : undefined),
    [config],
  );
  const isSet = useCallback(
    (key: string) => (setKeys ? (setKeys.get(key) ?? false) : undefined),
    [setKeys],
  );
  const legacyKeys = useMemo(
    () => (config ? legacyKeysOf(fields, config.credentials) : []),
    [config, fields],
  );
  const schema = useMemo(() => buildSchema(fields, (key) => isSet(key) === true), [fields, isSet]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: buildDefaults(fields, config?.isActive ?? false),
  });

  const isActive = useWatch({ control, name: 'isActive' }) as boolean;

  const toggleRemoved = (key: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const handleFormSubmit = handleSubmit((values) => {
    const kept = fields.filter((f) => !removed.has(f.key));
    updateChannel.mutate(
      {
        channelId,
        isActive: values.isActive === true,
        credentials: buildCredentialUpdate(kept, values, removed),
      },
      { onSuccess: onSaved },
    );
  });

  const webhookUrl = webhookUrlFor(window.location.origin, tenantId, channelId);

  return (
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

      {webhookUrl && <WebhookUrl url={webhookUrl} />}

      {/* Credential fields: blank keeps the stored value, a removed key is sent as null. */}
      {fields.map((field) => {
        const keySet = isSet(field.key);
        return (
          <CredentialField
            key={field.key}
            field={field}
            registration={register(field.key)}
            error={errors[field.key] as RHFFieldError | undefined}
            isSet={keySet}
            removal={
              field.optional && keySet
                ? { removed: removed.has(field.key), onToggle: () => toggleRemoved(field.key) }
                : undefined
            }
          />
        );
      })}

      {legacyKeys.length > 0 && (
        <LegacyCredentials keys={legacyKeys} removed={removed} onToggle={toggleRemoved} />
      )}

      <ChannelTestButton channelId={channelId} />

      <SheetFooter className="mt-auto flex-row gap-2 px-0">
        <Button type="submit" disabled={loading || isSubmitting || updateChannel.isPending}>
          {t('admin:channels.save')}
        </Button>
      </SheetFooter>
    </form>
  );
}
