import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import { useTenant } from '@/core/api/hooks/use-tenants';
import { useTenantSettings } from '@/admin/tenants/use-tenant-settings';
import { TenantSettingsForm } from '@/admin/tenants/tenant-settings-form';
import { RetentionPolicySection } from '@/admin/gdpr/retention-policy-section';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  Active: 'default',
  suspended: 'secondary',
  Suspended: 'destructive',
  deleted: 'destructive',
};

export default function TenantDetailPage() {
  const { tenantId = '' } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('admin');

  const { data: tenant } = useTenant(tenantId);
  const { data: settings } = useTenantSettings(tenantId);

  const [retentionOpen, setRetentionOpen] = useState(false);

  const displayName = tenant?.name ?? settings?.name ?? tenantId;
  const status = tenant?.status ?? settings?.status ?? 'unknown';
  const plan = settings?.plan;

  return (
    <div className="space-y-6" data-testid="tenant-detail-page">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin/tenants')}
        data-testid="back-to-tenants"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t('tenants.detail.back', 'Back to tenants')}
      </Button>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{tenantId}</span>
        <Badge
          variant={STATUS_VARIANT[status] ?? 'outline'}
          data-status={status}
          data-testid="tenant-status-badge"
        >
          {status}
        </Badge>
        {plan && <Badge variant="outline">{plan}</Badge>}
      </div>

      <PageHeader title={displayName} description={t('tenants.detail.subtitle', 'Tenant settings, security, features and quotas.')} />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" data-testid="tab-general">
            {t('tenants.detail.tabs.general', 'General')}
          </TabsTrigger>
          <TabsTrigger value="operational" data-testid="tab-operational">
            {t('tenants.detail.tabs.operational', 'Operational')}
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            {t('tenants.detail.tabs.security', 'Security')}
          </TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">
            {t('tenants.detail.tabs.features', 'Features')}
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">
            {t('tenants.detail.tabs.billing', 'Billing overrides')}
          </TabsTrigger>
          <TabsTrigger value="retention" data-testid="tab-retention">
            {t('tenants.detail.tabs.retention', 'Retention')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-4" data-testid="tab-content-general">
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <InfoRow
              label={t('tenants.detail.fields.tenantId', 'Tenant ID')}
              value={tenantId}
              mono
            />
            <InfoRow
              label={t('tenants.detail.fields.name', 'Display name')}
              value={displayName}
            />
            <InfoRow label={t('tenants.detail.fields.status', 'Status')} value={status} />
            <InfoRow
              label={t('tenants.detail.fields.type', 'Type')}
              value={settings?.type ?? '—'}
            />
            <InfoRow
              label={t('tenants.detail.fields.plan', 'Plan')}
              value={settings?.plan ?? '—'}
            />
            <InfoRow
              label={t('tenants.detail.fields.rateLimitTier', 'Rate-limit tier')}
              value={settings?.rateLimitTier ?? '—'}
            />
          </div>
        </TabsContent>

        <TabsContent value="operational" className="pt-4" data-testid="tab-content-operational">
          <TenantSettingsForm tenantId={tenantId} section="operational" />
        </TabsContent>

        <TabsContent value="security" className="pt-4" data-testid="tab-content-security">
          <TenantSettingsForm tenantId={tenantId} section="auth" />
        </TabsContent>

        <TabsContent value="features" className="pt-4" data-testid="tab-content-features">
          <FeaturesSection enabled={settings?.enabledFeatures ?? []} addOns={settings?.addOns ?? []} t={t} />
        </TabsContent>

        <TabsContent value="billing" className="pt-4" data-testid="tab-content-billing">
          <TenantSettingsForm tenantId={tenantId} section="quotas" />
        </TabsContent>

        {/* Retention tab — wires the shared <RetentionPolicySection /> sheet
            (S4.5). The inline form remains as a fallback summary view. */}
        <TabsContent value="retention" className="pt-4" data-testid="tab-content-retention">
          <div className="space-y-4" data-testid="retention-section-slot">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRetentionOpen(true)}
              data-testid="retention-policy-trigger"
            >
              <Clock className="mr-1.5 h-4 w-4" />
              {t('tenants.detail.retention.openSheet', 'Edit retention policy')}
            </Button>
            <TenantSettingsForm tenantId={tenantId} section="retention" />
          </div>
        </TabsContent>
      </Tabs>

      <RetentionPolicySection
        tenantId={tenantId}
        open={retentionOpen}
        onOpenChange={setRetentionOpen}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function FeaturesSection({
  enabled,
  addOns,
  t,
}: Readonly<{
  enabled: readonly string[];
  addOns: readonly string[];
  t: ReturnType<typeof useTranslation<'admin'>>['t'];
}>) {
  return (
    <div className="space-y-4 max-w-2xl" data-testid="tenant-features-tab">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('tenants.detail.features.enabled', 'Enabled features')}
        </p>
        {enabled.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('tenants.detail.features.empty', 'No features enabled.')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enabled.map((f) => (
              <Badge key={f} variant="secondary" data-testid={`feature-${f}`}>
                {f}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('tenants.detail.features.addOns', 'Add-ons')}
        </p>
        {addOns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('tenants.detail.features.addOnsEmpty', 'No add-ons.')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {addOns.map((a) => (
              <Badge key={a} variant="outline" data-testid={`addon-${a}`}>
                {a}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
