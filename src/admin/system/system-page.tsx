import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Server, Save } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Separator } from '@/core/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { LicenseCard } from './license-card';
import { useSystemLicense, useSystemCluster, useUpdateSystemSettings } from '@/core/api/hooks/use-system';

/* ---------- Constants ---------- */

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Bogota',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Lima',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Berlin',
  'UTC',
] as const;

const LANGUAGES = [
  { value: 'es-419', label: 'Español (Latinoamérica)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
] as const;

const HEALTH_STYLES: Record<string, { variant: 'default' | 'destructive' | 'outline'; label: string }> = {
  healthy: { variant: 'default', label: 'Healthy' },
  degraded: { variant: 'outline', label: 'Degraded' },
  unhealthy: { variant: 'destructive', label: 'Unhealthy' },
};

/* ---------- Settings form schema ---------- */

const settingsSchema = z.object({
  platformName: z.string().min(1, 'Platform name is required'),
  defaultTimezone: z.string().min(1, 'Timezone is required'),
  defaultLanguage: z.string().min(1, 'Language is required'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

/* ---------- Component ---------- */

export default function SystemPage() {
  const { t } = useTranslation(['admin']);
  const { data: license } = useSystemLicense();
  const { data: cluster } = useSystemCluster();
  const updateSettings = useUpdateSystemSettings();

  const nodes = cluster?.nodes ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      platformName: 'Asterisk Platform',
      defaultTimezone: 'America/Bogota',
      defaultLanguage: 'es-419',
    },
  });

  const onSubmit = handleSubmit((values) => {
    updateSettings.mutate(values);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <h1 className="font-heading text-2xl font-semibold">{t('admin:system.title')}</h1>

      {/* Section 1: License */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:system.license_tier')}
        </h2>
        {license ? (
          <LicenseCard
            license={{
              tier: license.tier,
              maxAgents: license.maxAgents,
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              features: license.features,
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('admin:system.loading')}</p>
        )}
      </section>

      <Separator />

      {/* Section 2: Cluster Status */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:system.cluster')}
        </h2>
        {nodes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {nodes.map((node) => {
              const healthStyle = HEALTH_STYLES[node.status] ?? { variant: 'destructive' as const, label: node.status };
              return (
                <div
                  key={node.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{node.id}</p>
                  </div>
                  <Badge variant={healthStyle.variant}>{healthStyle.label}</Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('admin:system.no_nodes')}</p>
        )}
      </section>

      <Separator />

      {/* Section 3: System Settings */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:system.settings')}
        </h2>
        <form onSubmit={onSubmit} className="max-w-lg space-y-4">
          {/* Platform name */}
          <div className="space-y-1.5">
            <Label htmlFor="platformName">{t('admin:system.platform_name')}</Label>
            <Input
              id="platformName"
              aria-invalid={!!errors.platformName}
              {...register('platformName')}
            />
            {errors.platformName && (
              <p className="text-xs text-destructive">{errors.platformName.message}</p>
            )}
          </div>

          {/* Default timezone */}
          <div className="space-y-1.5">
            <Label>{t('admin:system.default_timezone')}</Label>
            <Select value={watch('defaultTimezone')} onValueChange={(v) => setValue('defaultTimezone', v as string, { shouldDirty: true })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default language */}
          <div className="space-y-1.5">
            <Label>{t('admin:system.default_language')}</Label>
            <Select value={watch('defaultLanguage')} onValueChange={(v) => setValue('defaultLanguage', v as string, { shouldDirty: true })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={!isDirty || updateSettings.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {t('admin:system.save')}
          </Button>
        </form>
      </section>
    </div>
  );
}
