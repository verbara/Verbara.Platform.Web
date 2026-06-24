import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useForm,
  useWatch,
  Controller,
  type Resolver,
  type FieldError as RHFFieldError,
  type UseFormRegisterReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useUpsertTenantLlmConfig } from '@/core/api/hooks/use-typification-llm';
import type {
  AiSource,
  LlmProviderType,
  TenantLlmConfig,
  UpsertLlmConfigInput,
  LlmProviderSettings,
  TestLlmConnectionInput,
} from '@/core/api/hooks/use-typification-llm';
import { LlmTestButton } from './llm-test-button';
import { AiCreditsReadout } from './ai-credits-readout';
import {
  LLM_PROVIDERS,
  llmProviderFields,
  buildSchema,
  buildDefaults,
} from './llm-provider-fields';

interface LlmConfigFormProps {
  /** The currently-stored masked config, or `null` when none is configured. */
  config: TenantLlmConfig | null;
  /** Whether the Verbara-managed (PlatformManaged) LLM is offered for this
   *  tenant's plan. When false the managed toggle is disabled. */
  platformLlmAvailable: boolean;
}

interface SettingFieldProps {
  fieldKey: string;
  label: string;
  required: boolean;
  error: RHFFieldError | undefined;
  register: UseFormRegisterReturn;
}

function SettingField({ fieldKey, label, required, error, register }: Readonly<SettingFieldProps>) {
  const { t } = useTranslation(['admin']);
  const a11y = useFieldA11y(error, `llm-${fieldKey}`, { required });
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`llm-${fieldKey}`} required={required}>
        {label}
      </Label>
      <Input id={`llm-${fieldKey}`} type="text" {...a11y.inputProps} {...register} />
      <FieldError
        id={a11y.errorId}
        message={error?.message ? t(String(error.message)) : undefined}
      />
    </div>
  );
}

export function LlmConfigForm({ config, platformLlmAvailable }: Readonly<LlmConfigFormProps>) {
  const { t } = useTranslation(['admin']);
  const upsert = useUpsertTenantLlmConfig();

  // AI source toggle: Byo (bring-your-own provider) ↔ PlatformManaged (Verbara
  // hosts the LLM). Seed from the stored config; default to Byo. When managed,
  // the BYO provider/model/key sections are hidden and the BYO schema is
  // bypassed so its required fields can't block a managed submit.
  const [aiSource, setAiSource] = useState<AiSource>(config?.aiSource ?? 'Byo');
  const isManaged = aiSource === 'PlatformManaged';

  // The selected provider type drives both the schema and the conditional
  // fields. Seed from the stored config or default to OpenAI-compatible.
  const initialProvider: LlmProviderType = config?.providerType ?? 'OpenAiCompatible';

  // The resolver is captured once at the `useForm` call, so the schema must be
  // re-derived reactively from the live provider type (mirrors
  // `channel-config-form.tsx`). Driving it off a piece of React state — synced
  // on provider change — makes the conditional required fields (Azure
  // deployment/api-version, …) re-validate after an in-form provider switch
  // instead of being frozen to the mount-time provider.
  const [providerType, setProviderType] = useState<LlmProviderType>(initialProvider);
  const schema = useMemo(() => buildSchema(providerType), [providerType]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    resetField,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({
    // The schema shape depends on the provider type; cast the reactive resolver
    // to a permissive Resolver — `providerType` state re-derives it above. In
    // PlatformManaged mode the BYO schema is BYPASSED (resolver omitted) so its
    // required model/baseUrl fields don't block a managed submit.
    resolver: isManaged
      ? undefined
      : (zodResolver(schema) as unknown as Resolver<Record<string, unknown>>),
    defaultValues: hydrateDefaults(config, initialProvider),
  });

  const enabled = useWatch({ control, name: 'enabled' }) as boolean;
  const fields = useMemo(() => llmProviderFields[providerType] ?? [], [providerType]);

  // The masked-key UX: when a key is stored the placeholder is the bullet mask
  // and a "configured ✓ ••••last4" badge shows; the field stays empty so an
  // empty submit PRESERVES the stored key (only a typed value rotates it).
  const keySet = config?.keySet ?? false;
  const keyLast4 = config?.keyLast4 ?? null;
  const apiKeyA11y = useFieldA11y(undefined, 'llm-apiKey', { required: false });
  const modelA11y = useFieldA11y(errors.model as RHFFieldError | undefined, 'llm-model', {
    required: true,
  });

  const buildSettings = (values: Record<string, unknown>): LlmProviderSettings => {
    const settings: LlmProviderSettings = {};
    for (const field of llmProviderFields[values.providerType as LlmProviderType] ?? []) {
      const raw = values[field.key];
      if (typeof raw === 'string' && raw.length > 0) {
        settings[field.key] = raw;
      }
    }
    return settings;
  };

  const handleProviderChange = (next: string | null) => {
    if (!next) return;
    const nextProvider = next as LlmProviderType;
    setValue('providerType', nextProvider);
    // Re-derive the schema so the new provider's conditional required fields
    // (e.g. Azure deployment / api-version) are actually validated on submit.
    setProviderType(nextProvider);
    // Clear settings that don't belong to the new provider so stale values from
    // the previous type aren't submitted.
    const keep = new Set(llmProviderFields[nextProvider].map((f) => f.key));
    for (const provider of LLM_PROVIDERS) {
      for (const field of llmProviderFields[provider]) {
        if (!keep.has(field.key)) setValue(field.key, '');
      }
    }
    // Re-validate so stale errors from the previous provider's fields clear and
    // the new provider's now-required fields surface their errors.
    void trigger();
  };

  const handleFormSubmit = handleSubmit((values) => {
    const v = values as Record<string, unknown>;
    const apiKey = (v.apiKey as string) ?? '';
    // In managed mode the BYO model/baseUrl/key are irrelevant — preserve the
    // stored model (or default) and never rotate the key. In BYO mode the live
    // draft values drive the payload as before.
    const payload: UpsertLlmConfigInput = isManaged
      ? {
          providerType: config?.providerType ?? (v.providerType as LlmProviderType),
          model: config?.model ?? (v.model as string).trim(),
          apiKey: null,
          settings: config?.settings ?? null,
          enabled: v.enabled as boolean,
          aiSource,
        }
      : {
          providerType: v.providerType as LlmProviderType,
          model: (v.model as string).trim(),
          // Only send a non-empty key — empty PRESERVES the stored key server-side.
          apiKey: apiKey.length > 0 ? apiKey : null,
          settings: buildSettings(v),
          enabled: v.enabled as boolean,
          aiSource,
        };
    upsert.mutate(payload, {
      // After a successful save the masked "✓ Configured ••••last4" badge (fed
      // by the refetched config) is the single source of truth — clear the
      // write-only apiKey input so no plaintext key lingers and an immediate
      // re-save preserves the just-stored key (empty submit = preserve).
      onSuccess: () => resetField('apiKey'),
    });
  });

  // The test probe uses the live draft. A typed key probes the draft key;
  // otherwise the saved key is used server-side (apiKey omitted).
  const getTestDraft = (): TestLlmConnectionInput => {
    const apiKeyEl = document.getElementById('llm-apiKey') as HTMLInputElement | null;
    const modelEl = document.getElementById('llm-model') as HTMLInputElement | null;
    const draft: TestLlmConnectionInput = {
      providerType,
      model: modelEl?.value || undefined,
      settings: collectSettingsFromDom(providerType),
    };
    const typedKey = apiKeyEl?.value ?? '';
    if (typedKey.length > 0) draft.apiKey = typedKey;
    return draft;
  };

  return (
    <form onSubmit={handleFormSubmit} className="max-w-2xl space-y-6" data-testid="llm-config-form">
      {/* Manual-mode note: AI is opt-in; no provider = valid deterministic mode. */}
      <div
        className="flex items-start gap-3 rounded-md border bg-muted/40 p-4"
        data-testid="llm-manual-mode-note"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t('admin:typification.llm.manualModeNote')}
        </p>
      </div>

      {/* AI source: Byo ↔ PlatformManaged (Verbara-hosted). Disabled when the
          tenant's plan doesn't offer the managed LLM. */}
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="llm-aiSource" className="font-normal">
            {t('admin:typification.llm.aiSource.label')}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {platformLlmAvailable
              ? t(
                  isManaged
                    ? 'admin:typification.llm.aiSource.managed'
                    : 'admin:typification.llm.aiSource.byo',
                )
              : t('admin:typification.llm.aiSource.unavailableHint')}
          </p>
        </div>
        <Switch
          id="llm-aiSource"
          checked={isManaged}
          // Block ENABLING platform-managed without entitlement, but never block
          // DISABLING it: a tenant that opted in and later lost the PlanFeature
          // (platformLlmAvailable=false while aiSource=PlatformManaged) must still
          // be able to switch back to BYO — otherwise the BYO fields stay hidden
          // behind a disabled toggle and the config is un-editable.
          disabled={!platformLlmAvailable && !isManaged}
          onCheckedChange={(checked) => setAiSource(checked ? 'PlatformManaged' : 'Byo')}
          data-testid="llm-aiSource"
        />
      </div>

      {isManaged ? (
        <div className="space-y-4">
          <div
            className="flex items-start gap-3 rounded-md border bg-muted/40 p-4"
            data-testid="llm-managed-note"
          >
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t('admin:typification.llm.aiSource.managedNote')}
            </p>
          </div>
          <AiCreditsReadout />
        </div>
      ) : (
        <>
          {/* Provider type */}
          <div className="space-y-1.5">
            <Label required>{t('admin:typification.llm.fields.providerType')}</Label>
            <Controller
              name="providerType"
              control={control}
              render={({ field }) => (
                <Select
                  value={(field.value as string) || undefined}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger className="w-full" data-testid="llm-providerType">
                    <SelectValue
                      placeholder={t('admin:typification.llm.fields.providerTypePlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`admin:typification.llm.providers.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Model (always required) */}
          <div className="space-y-1.5">
            <Label htmlFor="llm-model" required>
              {t('admin:typification.llm.fields.model')}
            </Label>
            <Input
              id="llm-model"
              type="text"
              placeholder={t('admin:typification.llm.fields.modelPlaceholder')}
              {...modelA11y.inputProps}
              {...register('model')}
            />
            <FieldError
              id={modelA11y.errorId}
              message={
                (errors.model as RHFFieldError | undefined)?.message
                  ? t(String((errors.model as RHFFieldError).message))
                  : undefined
              }
            />
          </div>

          {/* Conditional provider-settings fields */}
          {fields.map((field) => (
            <SettingField
              key={field.key}
              fieldKey={field.key}
              label={t(field.labelKey)}
              required={field.required}
              error={errors[field.key] as RHFFieldError | undefined}
              register={register(field.key)}
            />
          ))}

          {/* API key (write-only, masked) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="llm-apiKey">{t('admin:typification.llm.fields.apiKey')}</Label>
              <span className="text-xs text-muted-foreground" data-testid="llm-apiKey-badge">
                {keySet
                  ? `✓ ${t('admin:typification.llm.fields.apiKeyConfigured', { last4: keyLast4 ?? '' })}`
                  : t('admin:typification.llm.fields.apiKeyNotConfigured')}
              </span>
            </div>
            <Input
              id="llm-apiKey"
              type="password"
              autoComplete="new-password"
              placeholder={keySet ? '••••••••' : ''}
              {...apiKeyA11y.inputProps}
              {...register('apiKey')}
            />
            <p className="text-xs text-muted-foreground">
              {t('admin:typification.llm.fields.apiKeyHint')}
            </p>
          </div>

          {/* Test connection */}
          <LlmTestButton getDraft={getTestDraft} />
        </>
      )}

      {/* Enabled */}
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="llm-enabled" className="font-normal">
            {t('admin:typification.llm.fields.enabled')}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('admin:typification.llm.fields.enabledHint')}
          </p>
        </div>
        <Switch
          id="llm-enabled"
          checked={enabled}
          onCheckedChange={(checked) => setValue('enabled', checked)}
          data-testid="llm-enabled"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || upsert.isPending}
          data-testid="llm-config-save"
        >
          {t('admin:typification.llm.save')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Seeds the form from the stored masked config. The provider settings are
 * hydrated from `config.settings`; `apiKey` is NEVER seeded (write-only —
 * empty submit preserves the stored key).
 */
function hydrateDefaults(
  config: TenantLlmConfig | null,
  provider: LlmProviderType,
): Record<string, string | boolean | LlmProviderType> {
  const defaults = buildDefaults(provider);
  if (!config) return defaults;
  defaults.model = config.model;
  defaults.enabled = config.enabled;
  for (const field of llmProviderFields[provider]) {
    const raw = config.settings[field.key];
    if (typeof raw === 'string') defaults[field.key] = raw;
  }
  return defaults;
}

/** Reads the live settings inputs from the DOM for the test draft. */
function collectSettingsFromDom(provider: LlmProviderType): LlmProviderSettings {
  const settings: LlmProviderSettings = {};
  for (const field of llmProviderFields[provider]) {
    const el = document.getElementById(`llm-${field.key}`) as HTMLInputElement | null;
    if (el?.value) settings[field.key] = el.value;
  }
  return settings;
}
