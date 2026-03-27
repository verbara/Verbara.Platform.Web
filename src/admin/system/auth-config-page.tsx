import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Checkbox } from '@/core/ui/checkbox';
import { Separator } from '@/core/ui/separator';
import { useAuthConfig, useUpdateAuthConfig, type AuthConfig } from '@/core/api/hooks/use-auth-admin';
import { useRoles } from '@/core/api/hooks/use-rbac';

export default function AuthConfigPage() {
  const { t } = useTranslation(['admin']);
  const { data: config } = useAuthConfig();
  const { data: roles = [] } = useRoles();
  const updateConfig = useUpdateAuthConfig();

  const [form, setForm] = useState<Partial<AuthConfig>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config) {
      setForm(config);
      setDirty(false);
    }
  }, [config]);

  function update<K extends keyof AuthConfig>(key: K, value: AuthConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    updateConfig.mutate(form);
    setDirty(false);
  }

  if (!config) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('status.loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t('admin:auth.config_title', 'Authentication Settings')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin:auth.config_description', 'Configure authentication policies and security settings')}</p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || updateConfig.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {t('actions.save', 'Save')}
        </Button>
      </div>

      {/* MFA Policy */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-medium">{t('admin:auth.mfa_policy', 'MFA Policy')}</h3>
        <div className="space-y-2">
          {(['optional', 'required_for_roles', 'required_all'] as const).map((policy) => (
            <label key={policy} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mfa-policy"
                checked={form.mfaPolicy === policy}
                onChange={() => update('mfaPolicy', policy)}
                className="accent-brand"
              />
              <span className="text-sm">{t(`admin:auth.mfa_${policy}`, policy)}</span>
            </label>
          ))}
        </div>

        {form.mfaPolicy === 'required_for_roles' && (
          <div className="ml-6 space-y-2 border-l-2 border-brand/20 pl-4">
            <Label>{t('admin:auth.mfa_required_roles', 'Required for these roles')}</Label>
            {roles.map((role) => (
              <label key={role.roleId} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.mfaRequiredRoles?.includes(role.name) ?? false}
                  onCheckedChange={(checked) => {
                    const current = form.mfaRequiredRoles ?? [];
                    const next = checked
                      ? [...current, role.name]
                      : current.filter((r) => r !== role.name);
                    update('mfaRequiredRoles', next);
                  }}
                />
                <span className="text-sm">{role.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Password Policy */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-medium">{t('admin:auth.password_policy', 'Password Policy')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('admin:auth.min_length', 'Minimum Length')}</Label>
            <Input
              type="number"
              min={8}
              max={128}
              value={form.passwordMinLength ?? 12}
              onChange={(e) => update('passwordMinLength', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t('admin:auth.require_uppercase', 'Require Uppercase')}</Label>
            <Switch
              checked={form.passwordRequireUppercase ?? true}
              onCheckedChange={(checked) => update('passwordRequireUppercase', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('admin:auth.require_number', 'Require Number')}</Label>
            <Switch
              checked={form.passwordRequireNumber ?? true}
              onCheckedChange={(checked) => update('passwordRequireNumber', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('admin:auth.require_special', 'Require Special Character')}</Label>
            <Switch
              checked={form.passwordRequireSpecial ?? false}
              onCheckedChange={(checked) => update('passwordRequireSpecial', checked)}
            />
          </div>
        </div>
      </div>

      {/* Lockout */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-medium">{t('admin:auth.lockout', 'Account Lockout')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('admin:auth.lockout_threshold', 'Failed Attempts Threshold')}</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={form.lockoutThreshold ?? 5}
              onChange={(e) => update('lockoutThreshold', Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin:auth.lockout_duration', 'Lockout Duration (minutes)')}</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={form.lockoutDurationMinutes ?? 15}
              onChange={(e) => update('lockoutDurationMinutes', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Session Timeouts */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-medium">{t('admin:auth.session_timeouts', 'Session Timeouts')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('admin:auth.idle_timeout', 'Idle Timeout')}</Label>
            <Input
              type="number"
              min={5}
              max={480}
              value={form.sessionIdleTimeoutMinutes ?? 30}
              onChange={(e) => update('sessionIdleTimeoutMinutes', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">{t('admin:auth.minutes', 'minutes')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('admin:auth.absolute_timeout', 'Absolute Timeout')}</Label>
            <Input
              type="number"
              min={1}
              max={72}
              value={form.sessionAbsoluteTimeoutHours ?? 12}
              onChange={(e) => update('sessionAbsoluteTimeoutHours', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">{t('admin:auth.hours', 'hours')}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* OIDC Config */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{t('admin:auth.oidc_config', 'OpenID Connect (SSO)')}</h3>
          <Switch
            checked={form.oidcEnabled ?? false}
            onCheckedChange={(checked) => update('oidcEnabled', checked)}
          />
        </div>

        {form.oidcEnabled && (
          <div className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label>{t('admin:auth.oidc_authority', 'Authority URL')}</Label>
              <Input
                value={form.oidcAuthority ?? ''}
                onChange={(e) => update('oidcAuthority', e.target.value)}
                placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin:auth.oidc_client_id', 'Client ID')}</Label>
              <Input
                value={form.oidcClientId ?? ''}
                onChange={(e) => update('oidcClientId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin:auth.oidc_client_secret', 'Client Secret')}</Label>
              <Input
                type="password"
                value={form.oidcClientSecret ?? ''}
                onChange={(e) => update('oidcClientSecret', e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin:auth.oidc_auto_create', 'Auto-create Users')}</Label>
              <Switch
                checked={form.oidcAutoCreateUsers ?? true}
                onCheckedChange={(checked) => update('oidcAutoCreateUsers', checked)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin:auth.oidc_default_role', 'Default Role for New Users')}</Label>
              <Input
                value={form.oidcDefaultRole ?? 'Agent'}
                onChange={(e) => update('oidcDefaultRole', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
