import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import {
  useIpAllowlist,
  useAddIpAllowlistEntry,
  useRemoveIpAllowlistEntry,
  useTenantSettings,
} from './use-tenant-settings';

const cidrSchema = z.object({
  cidr: z
    .string()
    .min(1, 'admin:tenants.ipAllowlist.validation.cidrRequired')
    .regex(
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/,
      'admin:tenants.ipAllowlist.validation.cidrFormat',
    ),
  description: z.string().min(1, 'admin:tenants.ipAllowlist.validation.descriptionRequired'),
});

type CidrFormValues = z.infer<typeof cidrSchema>;

export function IpAllowlistTab({ tenantId }: Readonly<{ tenantId: string }>) {
  const { t } = useTranslation('admin');
  const { data: settings } = useTenantSettings(tenantId);
  const { data: entries = [], isLoading } = useIpAllowlist(tenantId);
  const addEntry = useAddIpAllowlistEntry(tenantId);
  const removeEntry = useRemoveIpAllowlistEntry(tenantId);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const featureEnabled = settings?.enabledFeatures.includes('IpAllowlist') ?? false;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CidrFormValues>({
    resolver: zodResolver(cidrSchema),
    defaultValues: { cidr: '', description: '' },
  });

  const onAdd = handleSubmit((values) => {
    addEntry.mutate(values, { onSuccess: () => reset() });
  });

  if (!featureEnabled) {
    return (
      <div className="flex items-center gap-2 py-8" data-testid="ip-allowlist-upgrade">
        <ShieldAlert className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t('tenants.ipAllowlist.upgrade', 'Upgrade plan to enable IP Allowlist')}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6" data-testid="ip-allowlist-tab">
      <form onSubmit={onAdd} className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cidr">{t('tenants.ipAllowlist.cidr', 'CIDR')}</Label>
          <Input
            id="cidr"
            data-testid="ip-cidr-input"
            placeholder="192.168.1.0/24"
            aria-invalid={!!errors.cidr}
            {...register('cidr')}
          />
          {errors.cidr && (
            <p className="text-xs text-destructive">{t(errors.cidr.message ?? '')}</p>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="description">{t('tenants.ipAllowlist.description', 'Description')}</Label>
          <Input
            id="description"
            data-testid="ip-description-input"
            placeholder={t('tenants.ipAllowlist.description_placeholder', 'Office VPN')}
            aria-invalid={!!errors.description}
            {...register('description')}
          />
        </div>
        <Button type="submit" data-testid="ip-add-button" disabled={addEntry.isPending}>
          {t('tenants.ipAllowlist.add', 'Add')}
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t('tenants.ipAllowlist.loading', 'Loading...')}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="ip-allowlist-empty">
          {t('tenants.ipAllowlist.empty', 'No IP restrictions configured. All IPs are allowed.')}
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-4">
                <code className="text-sm font-medium">{entry.cidr}</code>
                <span className="text-sm text-muted-foreground">{entry.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  data-testid={`ip-delete-${entry.id}`}
                  onClick={() => setDeleteTarget(entry.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('tenants.ipAllowlist.delete_title', 'Remove IP entry')}
        description={t(
          'tenants.ipAllowlist.delete_description',
          'This IP range will be removed from the allowlist.',
        )}
        confirmLabel={t('tenants.ipAllowlist.delete_confirm', 'Remove')}
        onConfirm={() => {
          if (deleteTarget) {
            removeEntry.mutate(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
