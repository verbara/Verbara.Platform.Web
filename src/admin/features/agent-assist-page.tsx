import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Save } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  useAgentAssistFeature,
  useUpdateAgentAssistFeature,
  isLiveAgentAssistProvider,
  type AgentAssistProvider,
  type AgentAssistFeatureUpdate,
  type LiveAgentAssistProvider,
} from '@/core/api/hooks/use-agent-assist-feature';
import { useFormatDate } from '@/core/i18n/use-format';

/** The live providers (`agent-assist-feature.v2.json` `liveProviders`): deepgram alone. */
const PROVIDERS: { value: LiveAgentAssistProvider; labelKey: string }[] = [
  { value: 'deepgram', labelKey: 'admin:features.agent-assist.provider.deepgram' },
];

interface FormState {
  enabled: boolean;
  provider: LiveAgentAssistProvider | '';
  apiKey: string;
}

const EMPTY_FORM: FormState = {
  enabled: false,
  provider: '',
  apiKey: '',
};

export default function AgentAssistFeaturePage() {
  const { t } = useTranslation(['admin']);
  const { formatDateTime } = useFormatDate();
  const { data: feature, isLoading } = useAgentAssistFeature();
  const update = useUpdateAgentAssistFeature();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  // A row stored before only live providers were accepted: shown with a note, never preselected.
  const storedNotLive: AgentAssistProvider | null =
    feature?.provider && !isLiveAgentAssistProvider(feature.provider) ? feature.provider : null;

  // Sync server feature into editable local form on (re)load. Legitimate because
  // we need to overwrite both `form` and `dirty` after a successful refetch/save
  // round-trip; credentials are intentionally cleared (server returns masked).
  useEffect(() => {
    if (feature) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setForm({
        enabled: feature.enabled,
        provider: isLiveAgentAssistProvider(feature.provider) ? feature.provider : '',
        apiKey: '',
      });
      setDirty(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [feature]);

  // Enabled implies deepgram and an API key (design D3).
  const providerValid = useMemo(() => {
    if (!form.enabled) return true;
    return isLiveAgentAssistProvider(form.provider || null) && form.apiKey.trim().length > 0;
  }, [form]);

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    if (form.enabled && !isLiveAgentAssistProvider(form.provider || null)) return;
    const body: AgentAssistFeatureUpdate =
      form.enabled && form.provider
        ? {
            enabled: true,
            provider: form.provider,
            credentials: { apiKey: form.apiKey.trim() },
          }
        : { enabled: false, provider: null, credentials: null };
    update.mutate(body, {
      onSuccess: () => setDirty(false),
    });
  }

  return (
    <div className="space-y-6" data-testid="agent-assist-feature-page">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {t('admin:features.agent-assist.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin:features.agent-assist.description')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common:status.loading')}</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('admin:features.agent-assist.enabled')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('admin:features.agent-assist.warning-credentials-masked')}
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => patchForm('enabled', v)}
                aria-label={t('admin:features.agent-assist.aria.enableAgentAssist')}
                data-testid="agent-assist-enable-toggle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">{t('admin:features.agent-assist.provider.label')}</Label>
              <Select
                value={form.provider || ''}
                onValueChange={(v) => {
                  const next = PROVIDERS.find((p) => p.value === v)?.value;
                  if (next) patchForm('provider', next);
                }}
                disabled={!form.enabled}
              >
                <SelectTrigger
                  id="provider"
                  className="w-full"
                  data-testid="agent-assist-provider-select"
                  data-selected-provider={form.provider || 'none'}
                >
                  <SelectValue>
                    {(value: string | null) => {
                      const chosen = PROVIDERS.find((p) => p.value === value);
                      return chosen ? t(chosen.labelKey) : '';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem
                      key={p.value}
                      value={p.value}
                      data-provider={p.value}
                      data-testid={`agent-assist-provider-option-${p.value}`}
                    >
                      {t(p.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {storedNotLive && (
                <p
                  className="text-xs text-amber-700 dark:text-amber-400"
                  data-testid="agent-assist-provider-not-live"
                  data-stored-provider={storedNotLive}
                >
                  {t('admin:features.agent-assist.provider-not-live', {
                    provider: t(`admin:features.agent-assist.provider.${storedNotLive}`),
                  })}
                </p>
              )}
              {form.enabled && !form.provider && (
                <p className="text-xs text-destructive">
                  {t('admin:features.agent-assist.validation.provider-required')}
                </p>
              )}
            </div>

            {form.enabled && form.provider === 'deepgram' && (
              <div className="space-y-2">
                <Label htmlFor="api-key">{t('admin:features.agent-assist.api-key')}</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => patchForm('apiKey', e.target.value)}
                  data-testid="agent-assist-apikey-input"
                />
              </div>
            )}

            {feature?.credentialsConfigured && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span
                  className="font-medium"
                  data-testid="agent-assist-updated-by"
                  data-updated-at={feature.updatedAt ?? undefined}
                >
                  {t('admin:features.agent-assist.updated-by', {
                    user: feature.updatedBy ?? 'unknown',
                    at: feature.updatedAt ? formatDateTime(feature.updatedAt) : '',
                  })}
                </span>
                <span className="ml-2">
                  apiKey: {feature.apiKeyMasked ?? '—'}
                  {feature.endpointMasked && ` · endpoint: ${feature.endpointMasked}`}
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!dirty || !providerValid || update.isPending}
                data-testid="agent-assist-save-button"
              >
                <Save className="mr-2 h-4 w-4" />
                {t('admin:features.agent-assist.save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
