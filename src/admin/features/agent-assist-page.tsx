import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Save } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Textarea } from '@/core/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  useAgentAssistFeature,
  useUpdateAgentAssistFeature,
  type AgentAssistProvider,
  type AgentAssistFeatureUpdate,
} from '@/core/api/hooks/use-agent-assist-feature';
import { useFormatDate } from '@/core/i18n/use-format';

const PROVIDERS: { value: AgentAssistProvider; labelKey: string }[] = [
  { value: 'deepgram', labelKey: 'admin:features.agent-assist.provider.deepgram' },
  { value: 'whisper', labelKey: 'admin:features.agent-assist.provider.whisper' },
  { value: 'azure-whisper', labelKey: 'admin:features.agent-assist.provider.azure-whisper' },
  { value: 'google', labelKey: 'admin:features.agent-assist.provider.google' },
];

interface FormState {
  enabled: boolean;
  provider: AgentAssistProvider | '';
  apiKey: string;
  endpoint: string;
  googleJson: string;
}

const EMPTY_FORM: FormState = {
  enabled: false,
  provider: '',
  apiKey: '',
  endpoint: '',
  googleJson: '',
};

export default function AgentAssistFeaturePage() {
  const { t } = useTranslation(['admin']);
  const { formatDateTime } = useFormatDate();
  const { data: feature, isLoading } = useAgentAssistFeature();
  const update = useUpdateAgentAssistFeature();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  // Sync server feature into editable local form on (re)load. Legitimate because
  // we need to overwrite both `form` and `dirty` after a successful refetch/save
  // round-trip; credentials are intentionally cleared (server returns masked).
  useEffect(() => {
    if (feature) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setForm({
        enabled: feature.enabled,
        provider: feature.provider ?? '',
        apiKey: '',
        endpoint: '',
        googleJson: '',
      });
      setDirty(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [feature]);

  const providerValid = useMemo(() => {
    if (!form.enabled) return true;
    if (!form.provider) return false;
    if (form.provider === 'azure-whisper') {
      return form.apiKey.trim().length > 0 && form.endpoint.trim().length > 0;
    }
    if (form.provider === 'google') {
      return form.googleJson.trim().length > 0;
    }
    return form.apiKey.trim().length > 0;
  }, [form]);

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    const body: AgentAssistFeatureUpdate = form.enabled
      ? {
          enabled: true,
          provider: form.provider as AgentAssistProvider,
          credentials: buildCredentials(form),
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
                onValueChange={(v) => patchForm('provider', v as AgentAssistProvider)}
                disabled={!form.enabled}
              >
                <SelectTrigger id="provider" className="w-full" data-testid="agent-assist-provider-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {t(p.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.enabled && !form.provider && (
                <p className="text-xs text-destructive">
                  {t('admin:features.agent-assist.validation.provider-required')}
                </p>
              )}
            </div>

            {form.enabled && form.provider && (
              <CredentialsPanel form={form} patchForm={patchForm} />
            )}

            {feature?.credentialsConfigured && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium">
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

function buildCredentials(form: FormState) {
  if (form.provider === 'google') {
    return form.googleJson.trim() ? { apiKey: form.googleJson.trim() } : null;
  }
  if (form.provider === 'azure-whisper') {
    return {
      apiKey: form.apiKey.trim(),
      endpoint: form.endpoint.trim(),
    };
  }
  return form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : null;
}

function CredentialsPanel({
  form,
  patchForm,
}: {
  form: FormState;
  patchForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const { t } = useTranslation(['admin']);

  if (form.provider === 'google') {
    return (
      <div className="space-y-2">
        <Label htmlFor="google-json">
          {t('admin:features.agent-assist.credentials-json')}
        </Label>
        <Textarea
          id="google-json"
          rows={8}
          value={form.googleJson}
          onChange={(e) => patchForm('googleJson', e.target.value)}
          placeholder='{"type":"service_account",...}'
          className="font-mono text-xs"
        />
      </div>
    );
  }

  if (form.provider === 'azure-whisper') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="azure-endpoint">{t('admin:features.agent-assist.endpoint')}</Label>
          <Input
            id="azure-endpoint"
            value={form.endpoint}
            onChange={(e) => patchForm('endpoint', e.target.value)}
            placeholder="https://eastus.api.cognitive.microsoft.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="azure-key">{t('admin:features.agent-assist.api-key')}</Label>
          <Input
            id="azure-key"
            type="password"
            value={form.apiKey}
            onChange={(e) => patchForm('apiKey', e.target.value)}
          />
        </div>
      </div>
    );
  }

  // Deepgram + Whisper — single API key + optional base URL for Whisper
  return (
    <div className="space-y-4">
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
      {form.provider === 'whisper' && (
        <div className="space-y-2">
          <Label htmlFor="base-url">{t('admin:features.agent-assist.base-url')}</Label>
          <Input
            id="base-url"
            value={form.endpoint}
            onChange={(e) => patchForm('endpoint', e.target.value)}
            placeholder="https://api.openai.com"
          />
        </div>
      )}
    </div>
  );
}
