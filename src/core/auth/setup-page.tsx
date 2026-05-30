import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Copy, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { useSetup, type SetupResponse } from '@/core/api/hooks/use-system';

const setupSchema = z
  .object({
    email: z.string().email('common:setupPage.validation.emailInvalid'),
    password: z
      .string()
      .min(12, 'common:setupPage.validation.passwordPolicy')
      .regex(/[A-Z]/, 'common:setupPage.validation.passwordPolicy')
      .regex(/[0-9]/, 'common:setupPage.validation.passwordPolicy'),
    displayName: z.string().optional(),
    platformName: z.string().optional(),
    customerName: z.string().min(1, 'common:setupPage.validation.required'),
    customerTenantId: z
      .string()
      .min(1, 'common:setupPage.validation.required')
      .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'common:setupPage.validation.tenantIdSlug'),
    customerAdminEmail: z.string().email('common:setupPage.validation.emailInvalid'),
    customerAdminPassword: z
      .string()
      .min(12, 'common:setupPage.validation.passwordPolicy')
      .regex(/[A-Z]/, 'common:setupPage.validation.passwordPolicy')
      .regex(/[0-9]/, 'common:setupPage.validation.passwordPolicy'),
    customerAdminDisplayName: z.string().optional(),
  })
  .refine((v) => v.email.toLowerCase() !== v.customerAdminEmail.toLowerCase(), {
    path: ['customerAdminEmail'],
    message: 'common:setupPage.validation.emailsMustDiffer',
  });

type SetupFormValues = z.infer<typeof setupSchema>;

export default function SetupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const setup = useSetup();
  const [apiKeyResponse, setApiKeyResponse] = useState<SetupResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
      platformName: '',
      customerName: '',
      customerTenantId: '',
      customerAdminEmail: '',
      customerAdminPassword: '',
      customerAdminDisplayName: '',
    },
  });

  const emailA11y = useFieldA11y(errors.email, 'email', { required: true });
  const passwordA11y = useFieldA11y(errors.password, 'password', { required: true });

  const onSubmit = handleSubmit((values) => {
    setup.mutate(values, {
      onSuccess: (response) => {
        setApiKeyResponse(response);
      },
    });
  });

  const handleCopyKey = async () => {
    if (!apiKeyResponse) return;
    await navigator.clipboard.writeText(apiKeyResponse.managementApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    toast.success(t('setupPage.successToast'));
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">{t('setupPage.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('setupPage.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">{t('setupPage.platformAdminLegend')}</legend>
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                {t('setupPage.email')}
              </Label>
              <Input
                id="email"
                type="email"
                data-testid="setup-email"
                {...emailA11y.inputProps}
                {...register('email')}
              />
              <FieldError
                id={emailA11y.errorId}
                message={errors.email?.message ? t(errors.email.message) : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" required>
                {t('setupPage.password')}
              </Label>
              <Input
                id="password"
                type="password"
                data-testid="setup-password"
                {...passwordA11y.inputProps}
                {...register('password')}
              />
              <FieldError
                id={passwordA11y.errorId}
                message={errors.password?.message ? t(errors.password.message) : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">{t('setupPage.displayName')}</Label>
              <Input
                id="displayName"
                data-testid="setup-display-name"
                {...register('displayName')}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">{t('setupPage.platformLegend')}</legend>
            <div className="space-y-1.5">
              <Label htmlFor="platformName">{t('setupPage.platformName')}</Label>
              <Input
                id="platformName"
                data-testid="setup-platform-name"
                placeholder={t('setupPage.platformNamePlaceholder')}
                {...register('platformName')}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">{t('setupPage.customerLegend')}</legend>
            <div className="space-y-1.5">
              <Label htmlFor="customerName" required>
                {t('setupPage.customerName')}
              </Label>
              <Input
                id="customerName"
                data-testid="setup-customer-name"
                {...register('customerName')}
              />
              <FieldError
                id="customerName-error"
                message={errors.customerName?.message ? t(errors.customerName.message) : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerTenantId" required>
                {t('setupPage.customerTenantId')}
              </Label>
              <Input
                id="customerTenantId"
                data-testid="setup-customer-tenant-id"
                placeholder={t('setupPage.customerTenantIdPlaceholder')}
                {...register('customerTenantId')}
              />
              <FieldError
                id="customerTenantId-error"
                message={
                  errors.customerTenantId?.message ? t(errors.customerTenantId.message) : undefined
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerAdminEmail" required>
                {t('setupPage.customerAdminEmail')}
              </Label>
              <Input
                id="customerAdminEmail"
                type="email"
                data-testid="setup-customer-admin-email"
                {...register('customerAdminEmail')}
              />
              <FieldError
                id="customerAdminEmail-error"
                message={
                  errors.customerAdminEmail?.message
                    ? t(errors.customerAdminEmail.message)
                    : undefined
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerAdminPassword" required>
                {t('setupPage.customerAdminPassword')}
              </Label>
              <Input
                id="customerAdminPassword"
                type="password"
                data-testid="setup-customer-admin-password"
                {...register('customerAdminPassword')}
              />
              <FieldError
                id="customerAdminPassword-error"
                message={
                  errors.customerAdminPassword?.message
                    ? t(errors.customerAdminPassword.message)
                    : undefined
                }
              />
            </div>
          </fieldset>

          {setup.isError && (
            <p className="text-sm text-destructive" data-testid="setup-error">
              {setup.error?.message ?? t('setupPage.genericError')}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            data-testid="setup-submit"
            disabled={setup.isPending}
          >
            {setup.isPending ? t('setupPage.submitting') : t('setupPage.submit')}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {t('setupPage.alreadyConfigured')}{' '}
          <a href="/login" className="text-primary underline">
            {t('setupPage.signIn')}
          </a>
        </p>
      </div>

      <Dialog open={apiKeyResponse !== null} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" data-testid="api-key-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('setupPage.apiKeyTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('setupPage.apiKeyWarning')}</p>
          <div className="flex items-center gap-2 rounded border bg-muted p-3">
            <code className="flex-1 break-all text-xs" data-testid="api-key-value">
              {apiKeyResponse?.managementApiKey}
            </code>
            <Button variant="ghost" size="sm" onClick={handleCopyKey}>
              {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={handleDone} data-testid="api-key-done">
              {t('setupPage.apiKeyDone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
