import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
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
import { LicenseCard, type LicenseInfo } from './license-card';

/* ---------- Mock data ---------- */

const MOCK_LICENSE: LicenseInfo = {
  tier: 'Pro',
  maxAgents: 50,
  expiresAt: '2027-01-15T00:00:00Z',
  features: {
    'pro.cluster': true,
    'pro.dialer': true,
    'pro.analytics': true,
    'pro.routing': true,
    'pro.agentassist': true,
    'pro.callanalytics': false,
    'pro.multitenant': false,
  },
};

interface ClusterNode {
  id: string;
  role: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastHeartbeat: string;
}

const MOCK_CLUSTER_NODES: ClusterNode[] = [
  { id: 'node-01', role: 'primary', health: 'healthy', lastHeartbeat: '2026-03-22T14:55:00Z' },
  { id: 'node-02', role: 'secondary', health: 'healthy', lastHeartbeat: '2026-03-22T14:54:30Z' },
];

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
  const [license] = useState<LicenseInfo>(MOCK_LICENSE);
  const [nodes] = useState<ClusterNode[]>(MOCK_CLUSTER_NODES);

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

  const onSubmit = handleSubmit((_values) => {
    // TODO: POST /api/admin/system/settings
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
        <LicenseCard license={license} />
      </section>

      <Separator />

      {/* Section 2: Cluster Status */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:system.cluster')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {nodes.map((node) => {
            const healthStyle = HEALTH_STYLES[node.health] ?? { variant: 'destructive' as const, label: 'Unhealthy' };
            return (
              <div
                key={node.id}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Server className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{node.id}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {node.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin:system.last_heartbeat')}:{' '}
                    {formatDistanceToNow(new Date(node.lastHeartbeat), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant={healthStyle.variant}>{healthStyle.label}</Badge>
              </div>
            );
          })}
        </div>
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

          <Button type="submit" disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            {t('admin:system.save')}
          </Button>
        </form>
      </section>
    </div>
  );
}
