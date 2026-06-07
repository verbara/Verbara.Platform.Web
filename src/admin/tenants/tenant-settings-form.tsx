import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Switch } from '@/core/ui/switch';
import {
  useTenantSettings,
  useUpdateTenantSettings,
  type TenantSettingsDto,
  type UpdateTenantSettingsPayload,
} from '@/admin/tenants/use-tenant-settings';

export type TenantSettingsSection = 'operational' | 'auth' | 'quotas' | 'retention';

export interface TenantSettingsFormProps {
  readonly tenantId: string;
  readonly section: TenantSettingsSection;
}

type FieldErrors = Record<string, string | undefined>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toIntOrNull(v: string): number | null {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function intDisplay(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TenantSettingsForm({ tenantId, section }: TenantSettingsFormProps) {
  const { t } = useTranslation('admin');
  const { data: settings, isLoading } = useTenantSettings(tenantId);
  const update = useUpdateTenantSettings(tenantId);

  if (isLoading || !settings) {
    return (
      <p className="py-4 text-sm text-muted-foreground" data-testid="tenant-settings-loading">
        {t('tenants.settings.loading', 'Loading settings...')}
      </p>
    );
  }

  switch (section) {
    case 'operational':
      return <OperationalSection settings={settings} update={update} t={t} />;
    case 'auth':
      return <AuthSection settings={settings} update={update} t={t} />;
    case 'quotas':
      return <QuotasSection settings={settings} update={update} t={t} />;
    case 'retention':
      return <RetentionSection settings={settings} update={update} t={t} />;
    default:
      return null;
  }
}

// ─── Section: Operational ────────────────────────────────────────────────────

interface SectionProps {
  readonly settings: TenantSettingsDto;
  readonly update: ReturnType<typeof useUpdateTenantSettings>;
  readonly t: ReturnType<typeof useTranslation<'admin'>>['t'];
}

function OperationalSection({ settings, update, t }: SectionProps) {
  const [maxConcurrentChannels, setMaxConcurrentChannels] = useState<string>(
    intDisplay(settings.operational.maxConcurrentChannels),
  );
  const [maxActiveCampaigns, setMaxActiveCampaigns] = useState<string>(
    intDisplay(settings.operational.maxActiveCampaigns),
  );
  const [dialplanContextPrefix, setDialplanContextPrefix] = useState<string>(
    settings.operational.dialplanContextPrefix ?? '',
  );
  const [outboundCallerId, setOutboundCallerId] = useState<string>(
    settings.operational.outboundCallerId ?? '',
  );
  // W6 — tenant-default per-channel agent capacity. Voice is pinned to 1 (read-only).
  // The async defaults are plain bounded numbers (0–50), always carrying the current default.
  const [maxChatDefault, setMaxChatDefault] = useState<string>(
    intDisplay(settings.operational.maxChatDefault),
  );
  const [maxEmailDefault, setMaxEmailDefault] = useState<string>(
    intDisplay(settings.operational.maxEmailDefault),
  );
  const [maxSmsDefault, setMaxSmsDefault] = useState<string>(
    intDisplay(settings.operational.maxSmsDefault),
  );
  const [maxTotalDefault, setMaxTotalDefault] = useState<string>(
    intDisplay(settings.operational.maxTotalDefault),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const maxChannelsA11y = useFieldA11y(
    errors.maxConcurrentChannels ? { message: errors.maxConcurrentChannels } : undefined,
    'ts-max-channels',
    { required: true },
  );
  const maxCampaignsA11y = useFieldA11y(
    errors.maxActiveCampaigns ? { message: errors.maxActiveCampaigns } : undefined,
    'ts-max-campaigns',
    { required: true },
  );
  const maxChatA11y = useFieldA11y(
    errors.maxChatDefault ? { message: errors.maxChatDefault } : undefined,
    'ts-cap-chat',
    { required: true },
  );
  const maxEmailA11y = useFieldA11y(
    errors.maxEmailDefault ? { message: errors.maxEmailDefault } : undefined,
    'ts-cap-email',
    { required: true },
  );
  const maxSmsA11y = useFieldA11y(
    errors.maxSmsDefault ? { message: errors.maxSmsDefault } : undefined,
    'ts-cap-sms',
    { required: true },
  );
  const maxTotalA11y = useFieldA11y(
    errors.maxTotalDefault ? { message: errors.maxTotalDefault } : undefined,
    'ts-cap-total',
    { required: true },
  );

  // W6 — async capacity-default fields (Voice is rendered separately, pinned to 1).
  const capacityDefaultFields = [
    {
      key: 'maxChatDefault',
      id: 'ts-cap-chat',
      label: t('tenants.settings.fields.maxChatDefault', 'Default chat capacity'),
      value: maxChatDefault,
      setValue: setMaxChatDefault,
      a11y: maxChatA11y,
    },
    {
      key: 'maxEmailDefault',
      id: 'ts-cap-email',
      label: t('tenants.settings.fields.maxEmailDefault', 'Default email capacity'),
      value: maxEmailDefault,
      setValue: setMaxEmailDefault,
      a11y: maxEmailA11y,
    },
    {
      key: 'maxSmsDefault',
      id: 'ts-cap-sms',
      label: t('tenants.settings.fields.maxSmsDefault', 'Default SMS capacity'),
      value: maxSmsDefault,
      setValue: setMaxSmsDefault,
      a11y: maxSmsA11y,
    },
    {
      key: 'maxTotalDefault',
      id: 'ts-cap-total',
      label: t('tenants.settings.fields.maxTotalDefault', 'Default total capacity'),
      value: maxTotalDefault,
      setValue: setMaxTotalDefault,
      a11y: maxTotalA11y,
    },
  ] as const;

  // Advisory (non-blocking): MaxTotal default below the Chat default means that
  // channel can never reach its cap. Server allows it, so this NEVER blocks submit.
  const totalDefaultNum = Number(maxTotalDefault);
  const chatDefaultNum = Number(maxChatDefault);
  const showMaxTotalWarning =
    maxTotalDefault !== '' &&
    maxChatDefault !== '' &&
    Number.isFinite(totalDefaultNum) &&
    Number.isFinite(chatDefaultNum) &&
    totalDefaultNum < chatDefaultNum;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (maxConcurrentChannels === '' || Number(maxConcurrentChannels) < 1) {
      next.maxConcurrentChannels = t(
        'tenants.settings.errors.maxConcurrentChannelsRequired',
        'Must be 1 or greater',
      );
    }
    if (maxActiveCampaigns === '' || Number(maxActiveCampaigns) < 0) {
      next.maxActiveCampaigns = t(
        'tenants.settings.errors.maxActiveCampaignsRequired',
        'Must be 0 or greater',
      );
    }
    const capacityBound = (key: string, raw: string) => {
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n) || n < 0 || n > 50) {
        next[key] = t('tenants.settings.errors.capacityBound', 'Must be between 0 and 50');
      }
    };
    capacityBound('maxChatDefault', maxChatDefault);
    capacityBound('maxEmailDefault', maxEmailDefault);
    capacityBound('maxSmsDefault', maxSmsDefault);
    capacityBound('maxTotalDefault', maxTotalDefault);
    return next;
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    const payload: UpdateTenantSettingsPayload = {
      operational: {
        maxConcurrentChannels: Number(maxConcurrentChannels),
        maxActiveCampaigns: Number(maxActiveCampaigns),
        dialplanContextPrefix:
          dialplanContextPrefix.trim() === '' ? null : dialplanContextPrefix.trim(),
        outboundCallerId: outboundCallerId.trim() === '' ? null : outboundCallerId.trim(),
        // W6 — Voice stays pinned to 1 (server-enforced); send the async defaults verbatim.
        maxVoiceDefault: 1,
        maxChatDefault: Number(maxChatDefault),
        maxEmailDefault: Number(maxEmailDefault),
        maxSmsDefault: Number(maxSmsDefault),
        maxTotalDefault: Number(maxTotalDefault),
      },
    };

    try {
      await update.mutateAsync(payload);
      toast.success(t('tenants.settings.toasts.saved', 'Tenant settings saved'));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('tenants.settings.toasts.error', 'Failed to save tenant settings'),
      );
    }
  }

  return (
    <form
      className="space-y-4 max-w-xl"
      onSubmit={handleSubmit}
      data-testid="tenant-settings-form-operational"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ts-max-channels" required>
          {t('tenants.settings.fields.maxConcurrentChannels', 'Max concurrent channels')}
        </Label>
        <Input
          id="ts-max-channels"
          type="number"
          min={1}
          data-testid="field-maxConcurrentChannels"
          value={maxConcurrentChannels}
          onChange={(e) => setMaxConcurrentChannels(e.target.value)}
          {...maxChannelsA11y.inputProps}
        />
        {errors.maxConcurrentChannels && (
          <p
            id={maxChannelsA11y.errorId}
            role="alert"
            className="text-xs text-destructive"
            data-testid="field-error-maxConcurrentChannels"
          >
            {errors.maxConcurrentChannels}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-max-campaigns" required>
          {t('tenants.settings.fields.maxActiveCampaigns', 'Max active campaigns')}
        </Label>
        <Input
          id="ts-max-campaigns"
          type="number"
          min={0}
          data-testid="field-maxActiveCampaigns"
          value={maxActiveCampaigns}
          onChange={(e) => setMaxActiveCampaigns(e.target.value)}
          {...maxCampaignsA11y.inputProps}
        />
        {errors.maxActiveCampaigns && (
          <p
            id={maxCampaignsA11y.errorId}
            role="alert"
            className="text-xs text-destructive"
            data-testid="field-error-maxActiveCampaigns"
          >
            {errors.maxActiveCampaigns}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-dialplan-prefix">
          {t('tenants.settings.fields.dialplanContextPrefix', 'Dialplan context prefix')}
        </Label>
        <Input
          id="ts-dialplan-prefix"
          data-testid="field-dialplanContextPrefix"
          value={dialplanContextPrefix}
          onChange={(e) => setDialplanContextPrefix(e.target.value)}
          placeholder={t(
            'tenants.settings.placeholders.dialplanContextPrefix',
            'tenant-prefix (optional)',
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-outbound-caller-id">
          {t('tenants.settings.fields.outboundCallerId', 'Outbound caller ID')}
        </Label>
        <Input
          id="ts-outbound-caller-id"
          data-testid="field-outboundCallerId"
          value={outboundCallerId}
          onChange={(e) => setOutboundCallerId(e.target.value)}
          placeholder={t(
            'tenants.settings.placeholders.outboundCallerId',
            '+1 555 010 0000 (optional)',
          )}
        />
        <p className="text-xs text-muted-foreground">
          {t(
            'tenants.settings.hints.outboundCallerId',
            'Number shown on agent click-to-dial and external transfers. Falls back to the trunk default when empty.',
          )}
        </p>
      </div>

      {/* Capacity defaults (W6) — the per-channel baseline every agent inherits. */}
      <div
        data-testid="tenant-capacity-defaults-section"
        className="space-y-3 rounded-lg border bg-muted/30 p-4"
      >
        <Label>{t('tenants.settings.capacityDefaults', 'Capacity defaults')}</Label>

        {/* Voice — pinned to 1 (read-only) until simultaneous voice ships. */}
        <div className="space-y-1.5">
          <Label htmlFor="ts-cap-voice">
            {t('tenants.settings.fields.maxVoiceDefault', 'Default voice capacity')}
          </Label>
          <Input
            id="ts-cap-voice"
            data-testid="field-maxVoiceDefault"
            type="number"
            value="1"
            readOnly
            disabled
            title={t('agents.capacity.maxVoicePinnedHint')}
          />
          <p className="text-xs text-muted-foreground">{t('agents.capacity.maxVoicePinnedHint')}</p>
        </div>

        {capacityDefaultFields.map((cf) => (
          <div key={cf.key} className="space-y-1.5">
            <Label htmlFor={cf.id}>{cf.label}</Label>
            <Input
              id={cf.id}
              type="number"
              min={0}
              max={50}
              data-testid={`field-${cf.key}`}
              value={cf.value}
              onChange={(e) => cf.setValue(e.target.value)}
              {...cf.a11y.inputProps}
            />
            {errors[cf.key] && (
              <p
                id={cf.a11y.errorId}
                role="alert"
                className="text-xs text-destructive"
                data-testid={`field-error-${cf.key}`}
              >
                {errors[cf.key]}
              </p>
            )}
          </div>
        ))}

        {showMaxTotalWarning && (
          <p
            data-testid="tenant-capacity-total-warning"
            className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('agents.capacity.maxTotalBelowCapWarning')}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending} data-testid="tenant-settings-submit">
          {update.isPending
            ? t('tenants.settings.submitting', 'Saving...')
            : t('tenants.settings.save', 'Save changes')}
        </Button>
      </div>
    </form>
  );
}

// ─── Section: Auth ──────────────────────────────────────────────────────────

function AuthSection({ settings, update, t }: SectionProps) {
  const [mfaPolicy, setMfaPolicy] = useState<string>(settings.auth.mfaPolicy);
  const [passwordMinLength, setPasswordMinLength] = useState<string>(
    String(settings.auth.passwordMinLength),
  );
  const [oidcEnabled, setOidcEnabled] = useState<boolean>(settings.auth.oidcEnabled);
  const [errors, setErrors] = useState<FieldErrors>({});

  const passwordMinLengthA11y = useFieldA11y(
    errors.passwordMinLength ? { message: errors.passwordMinLength } : undefined,
    'ts-pwd-min',
    { required: true },
  );

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (passwordMinLength === '' || Number(passwordMinLength) < 8) {
      next.passwordMinLength = t(
        'tenants.settings.errors.passwordMinLength',
        'Minimum length must be 8 or greater',
      );
    }
    return next;
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    try {
      await update.mutateAsync({
        auth: {
          mfaPolicy,
          passwordMinLength: Number(passwordMinLength),
          oidcEnabled,
        },
      });
      toast.success(t('tenants.settings.toasts.saved', 'Tenant settings saved'));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('tenants.settings.toasts.error', 'Failed to save tenant settings'),
      );
    }
  }

  return (
    <form
      className="space-y-4 max-w-xl"
      onSubmit={handleSubmit}
      data-testid="tenant-settings-form-auth"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ts-mfa-policy">
          {t('tenants.settings.fields.mfaPolicy', 'MFA policy')}
        </Label>
        <Input
          id="ts-mfa-policy"
          data-testid="field-mfaPolicy"
          value={mfaPolicy}
          onChange={(e) => setMfaPolicy(e.target.value)}
          placeholder={t('admin:tenants.consentPolicyPlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-pwd-min" required>
          {t('tenants.settings.fields.passwordMinLength', 'Minimum password length')}
        </Label>
        <Input
          id="ts-pwd-min"
          type="number"
          min={8}
          data-testid="field-passwordMinLength"
          value={passwordMinLength}
          onChange={(e) => setPasswordMinLength(e.target.value)}
          {...passwordMinLengthA11y.inputProps}
        />
        {errors.passwordMinLength && (
          <p
            id={passwordMinLengthA11y.errorId}
            role="alert"
            className="text-xs text-destructive"
            data-testid="field-error-passwordMinLength"
          >
            {errors.passwordMinLength}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="ts-oidc-enabled" className="text-sm">
          {t('tenants.settings.fields.oidcEnabled', 'Enable OIDC sign-in')}
        </Label>
        <Switch
          id="ts-oidc-enabled"
          data-testid="field-oidcEnabled"
          checked={oidcEnabled}
          onCheckedChange={setOidcEnabled}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending} data-testid="tenant-settings-submit">
          {update.isPending
            ? t('tenants.settings.submitting', 'Saving...')
            : t('tenants.settings.save', 'Save changes')}
        </Button>
      </div>
    </form>
  );
}

// ─── Section: Quotas ────────────────────────────────────────────────────────

function QuotasSection({ settings, update, t }: SectionProps) {
  const [maxMonthlyVoiceMinutes, setMaxMonthlyVoiceMinutes] = useState<string>(
    intDisplay(settings.quotas.maxMonthlyVoiceMinutes),
  );
  const [maxMonthlyMessages, setMaxMonthlyMessages] = useState<string>(
    intDisplay(settings.quotas.maxMonthlyMessages),
  );
  const [quotaAction, setQuotaAction] = useState<string>(settings.quotas.quotaAction);

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        quotas: {
          maxMonthlyVoiceMinutes: toIntOrNull(maxMonthlyVoiceMinutes),
          maxMonthlyMessages: toIntOrNull(maxMonthlyMessages),
          quotaAction,
        },
      });
      toast.success(t('tenants.settings.toasts.saved', 'Tenant settings saved'));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('tenants.settings.toasts.error', 'Failed to save tenant settings'),
      );
    }
  }

  return (
    <form
      className="space-y-4 max-w-xl"
      onSubmit={handleSubmit}
      data-testid="tenant-settings-form-quotas"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ts-q-voice">
          {t('tenants.settings.fields.maxMonthlyVoiceMinutes', 'Max voice minutes / month')}
        </Label>
        <Input
          id="ts-q-voice"
          type="number"
          min={0}
          data-testid="field-maxMonthlyVoiceMinutes"
          value={maxMonthlyVoiceMinutes}
          onChange={(e) => setMaxMonthlyVoiceMinutes(e.target.value)}
          placeholder={t('tenants.settings.placeholders.unlimited', 'Leave empty for unlimited')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-q-msg">
          {t('tenants.settings.fields.maxMonthlyMessages', 'Max messages / month')}
        </Label>
        <Input
          id="ts-q-msg"
          type="number"
          min={0}
          data-testid="field-maxMonthlyMessages"
          value={maxMonthlyMessages}
          onChange={(e) => setMaxMonthlyMessages(e.target.value)}
          placeholder={t('tenants.settings.placeholders.unlimited', 'Leave empty for unlimited')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-q-action">
          {t('tenants.settings.fields.quotaAction', 'Quota exceeded action')}
        </Label>
        <Input
          id="ts-q-action"
          data-testid="field-quotaAction"
          value={quotaAction}
          onChange={(e) => setQuotaAction(e.target.value)}
          placeholder={t('admin:tenants.recordingActionPlaceholder')}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending} data-testid="tenant-settings-submit">
          {update.isPending
            ? t('tenants.settings.submitting', 'Saving...')
            : t('tenants.settings.save', 'Save changes')}
        </Button>
      </div>
    </form>
  );
}

// ─── Section: Retention (placeholder until B.5 wires RetentionPolicySection) ─

function RetentionSection({ settings, update, t }: SectionProps) {
  const [conversationRetentionDays, setConversationRetentionDays] = useState<string>(
    intDisplay(settings.retention.conversationRetentionDays),
  );
  const [authEventRetentionDays, setAuthEventRetentionDays] = useState<string>(
    intDisplay(settings.retention.authEventRetentionDays),
  );

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        retention: {
          conversationRetentionDays: toIntOrNull(conversationRetentionDays),
          authEventRetentionDays: toIntOrNull(authEventRetentionDays),
        },
      });
      toast.success(t('tenants.settings.toasts.saved', 'Tenant settings saved'));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('tenants.settings.toasts.error', 'Failed to save tenant settings'),
      );
    }
  }

  return (
    <form
      className="space-y-4 max-w-xl"
      onSubmit={handleSubmit}
      data-testid="tenant-settings-form-retention"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ts-r-conv">
          {t('tenants.settings.fields.conversationRetentionDays', 'Conversation retention (days)')}
        </Label>
        <Input
          id="ts-r-conv"
          type="number"
          min={1}
          data-testid="field-conversationRetentionDays"
          value={conversationRetentionDays}
          onChange={(e) => setConversationRetentionDays(e.target.value)}
          placeholder={t('tenants.settings.placeholders.useDefault', 'Use platform default')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-r-auth">
          {t('tenants.settings.fields.authEventRetentionDays', 'Auth event retention (days)')}
        </Label>
        <Input
          id="ts-r-auth"
          type="number"
          min={1}
          data-testid="field-authEventRetentionDays"
          value={authEventRetentionDays}
          onChange={(e) => setAuthEventRetentionDays(e.target.value)}
          placeholder={t('tenants.settings.placeholders.useDefault', 'Use platform default')}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending} data-testid="tenant-settings-submit">
          {update.isPending
            ? t('tenants.settings.submitting', 'Saving...')
            : t('tenants.settings.save', 'Save changes')}
        </Button>
      </div>
    </form>
  );
}
