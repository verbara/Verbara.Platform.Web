import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import {
  useTenantSettings,
  useUpdateTenantSettings,
  type UpdateAuthPayload,
} from './use-tenant-settings';

const ssoSchema = z
  .object({
    oidcEnabled: z.boolean(),
    oidcAuthority: z.string(),
    oidcClientId: z.string(),
    oidcClientSecret: z.string(),
    oidcAutoCreateUsers: z.boolean(),
    oidcDefaultRole: z.string().min(1),
  })
  .refine((d) => !d.oidcEnabled || d.oidcAuthority.length > 0, {
    path: ['oidcAuthority'],
    message: 'admin:tenants.sso.validation.authorityRequired',
  })
  .refine((d) => !d.oidcEnabled || d.oidcClientId.length > 0, {
    path: ['oidcClientId'],
    message: 'admin:tenants.sso.validation.clientIdRequired',
  })
  .refine(
    (d) => {
      if (d.oidcAuthority.length === 0) return true;
      try {
        new URL(d.oidcAuthority);
        return true;
      } catch {
        return false;
      }
    },
    { path: ['oidcAuthority'], message: 'admin:tenants.sso.validation.authorityInvalid' },
  );

type SsoFormValues = z.infer<typeof ssoSchema>;

export function SsoTab({ tenantId }: Readonly<{ tenantId: string }>) {
  const { t } = useTranslation('admin');
  const { data: settings } = useTenantSettings(tenantId);
  const update = useUpdateTenantSettings(tenantId);

  const featureEnabled = settings?.enabledFeatures.includes('OidcSso') ?? false;
  const auth = settings?.auth;

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<SsoFormValues>({
    resolver: zodResolver(ssoSchema),
    values: auth
      ? {
          oidcEnabled: auth.oidcEnabled,
          oidcAuthority: auth.oidcAuthority ?? '',
          oidcClientId: auth.oidcClientId ?? '',
          oidcClientSecret: '',
          oidcAutoCreateUsers: auth.oidcAutoCreateUsers,
          oidcDefaultRole: auth.oidcDefaultRole || 'Agent',
        }
      : undefined,
  });

  const authorityA11y = useFieldA11y(errors.oidcAuthority, 'sso-authority', { required: true });
  const clientIdA11y = useFieldA11y(errors.oidcClientId, 'sso-clientId', { required: true });
  const clientSecretA11y = useFieldA11y(undefined, 'sso-clientSecret', { required: false });
  const defaultRoleA11y = useFieldA11y(errors.oidcDefaultRole, 'sso-defaultRole', {
    required: true,
  });

  if (!featureEnabled) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">
            {t('tenants.sso.upgrade.title')}
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {t('tenants.sso.upgrade.body')}
          </p>
        </div>
      </div>
    );
  }

  const onSubmit = (values: SsoFormValues) => {
    const authPayload: UpdateAuthPayload = {
      oidcEnabled: values.oidcEnabled,
      oidcAuthority: values.oidcAuthority || null,
      oidcClientId: values.oidcClientId || null,
      oidcAutoCreateUsers: values.oidcAutoCreateUsers,
      oidcDefaultRole: values.oidcDefaultRole,
    };
    if (values.oidcClientSecret.length > 0) {
      authPayload.oidcClientSecret = values.oidcClientSecret;
    }
    update.mutate({ auth: authPayload });
  };

  const enabledValue = watch('oidcEnabled');
  const authorityValue = watch('oidcAuthority');
  const clientIdValue = watch('oidcClientId');
  const testSignInDisabled =
    !enabledValue || authorityValue.length === 0 || clientIdValue.length === 0;

  const handleTestSignIn = () => {
    const returnUrl = `/admin/tenants/${tenantId}`;
    const url = `/api/v1/auth/oidc/login?tenant_id=${encodeURIComponent(tenantId)}&return_url=${encodeURIComponent(returnUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const secretConfigured = !!auth?.oidcClientId;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-heading text-lg font-semibold">{t('tenants.sso.tabTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('tenants.sso.description')}</p>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="sso-enabled" className="font-normal">
          {t('tenants.sso.enabled')}
        </Label>
        <Controller
          name="oidcEnabled"
          control={control}
          render={({ field }) => (
            <Switch
              id="sso-enabled"
              checked={field.value}
              onCheckedChange={field.onChange}
              data-testid="sso-enabled"
            />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sso-authority" required>
          {t('tenants.sso.authority')}
        </Label>
        <Input
          id="sso-authority"
          type="url"
          placeholder="https://login.example.com/v2.0"
          {...register('oidcAuthority')}
          {...authorityA11y.inputProps}
        />
        <p className="text-xs text-muted-foreground">{t('tenants.sso.authorityHint')}</p>
        <FieldError
          id={authorityA11y.errorId}
          message={
            errors.oidcAuthority?.message ? t(errors.oidcAuthority.message.toString()) : undefined
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sso-clientId" required>
          {t('tenants.sso.clientId')}
        </Label>
        <Input id="sso-clientId" {...register('oidcClientId')} {...clientIdA11y.inputProps} />
        <FieldError
          id={clientIdA11y.errorId}
          message={
            errors.oidcClientId?.message ? t(errors.oidcClientId.message.toString()) : undefined
          }
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="sso-clientSecret">{t('tenants.sso.clientSecret')}</Label>
          <span className="text-xs text-muted-foreground">
            {secretConfigured
              ? `✓ ${t('tenants.sso.clientSecretConfigured')}`
              : t('tenants.sso.clientSecretNotConfigured')}
          </span>
        </div>
        <Input
          id="sso-clientSecret"
          type="password"
          autoComplete="new-password"
          placeholder={secretConfigured ? '••••••••' : ''}
          {...register('oidcClientSecret')}
          {...clientSecretA11y.inputProps}
        />
        <p className="text-xs text-muted-foreground">{t('tenants.sso.clientSecretHint')}</p>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="sso-autoCreate" className="font-normal">
            {t('tenants.sso.autoCreateUsers')}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('tenants.sso.autoCreateUsersHint')}
          </p>
        </div>
        <Controller
          name="oidcAutoCreateUsers"
          control={control}
          render={({ field }) => (
            <Switch id="sso-autoCreate" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sso-defaultRole" required>
          {t('tenants.sso.defaultRole')}
        </Label>
        <Input
          id="sso-defaultRole"
          {...register('oidcDefaultRole')}
          {...defaultRoleA11y.inputProps}
        />
        <FieldError
          id={defaultRoleA11y.errorId}
          message={errors.oidcDefaultRole?.message?.toString()}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testSignInDisabled}
          onClick={handleTestSignIn}
          aria-label={t('tenants.sso.testSignIn')}
          title={testSignInDisabled ? '' : t('tenants.sso.testSignInHint')}
        >
          <ExternalLink className="mr-1.5 h-4 w-4" />
          {t('tenants.sso.testSignIn')}
        </Button>

        <Button type="submit" disabled={update.isPending}>
          {t('tenants.sso.save')}
        </Button>
      </div>
    </form>
  );
}
