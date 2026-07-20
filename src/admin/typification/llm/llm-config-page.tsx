import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/core/ui/page-header';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import {
  useTenantLlmConfig,
  useDeleteTenantLlmConfig,
  isLlmConfigEmpty,
  type TenantLlmConfig,
} from '@/core/api/hooks/use-typification-llm';
import { LlmConfigForm } from './llm-config-form';

export default function LlmConfigPage() {
  const { t } = useTranslation(['admin']);
  const { data, isLoading } = useTenantLlmConfig();
  const deleteConfig = useDeleteTenantLlmConfig();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // GET empty-vs-config discrimination: the endpoint returns `{configured:false}`
  // (a VALID 200 — manual/deterministic mode) OR the masked config. `config` is
  // the masked config when present, else null; the form treats null as "create".
  const config: TenantLlmConfig | null = data && !isLlmConfigEmpty(data) ? data : null;
  const isConfigured = config !== null;

  // `platformLlmAvailable` is present in BOTH GET branches (empty + config) so
  // the form can offer the Verbara-managed toggle without a second request.
  const platformLlmAvailable = config?.platformLlmAvailable ?? data?.platformLlmAvailable ?? false;

  // `key` remounts the form when switching configured ↔ empty so RHF re-seeds
  // its defaults from the freshly-fetched masked config.
  const body = isLoading ? (
    <PageSkeleton />
  ) : (
    <LlmConfigForm
      key={isConfigured ? 'configured' : 'empty'}
      config={config}
      platformLlmAvailable={platformLlmAvailable}
    />
  );

  return (
    <div className="space-y-6" data-testid="llm-config-page">
      <PageHeader
        title={t('admin:typification.llm.title')}
        description={t('admin:typification.llm.description')}
      >
        {isConfigured && (
          <>
            <Badge
              variant={config.enabled ? 'default' : 'secondary'}
              data-testid="llm-status-badge"
            >
              {config.enabled
                ? t('admin:typification.llm.statusEnabled')
                : t('admin:typification.llm.statusDisabled')}
            </Badge>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              data-testid="llm-config-delete"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t('admin:typification.llm.delete')}
            </Button>
          </>
        )}
      </PageHeader>

      {body}

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteConfig.mutate(undefined, { onSuccess: () => setDeleteOpen(false) })}
        entityName={config ? t(`admin:typification.llm.providers.${config.providerType}`) : ''}
        entityType={t('admin:typification.llm.entityType')}
        isPending={deleteConfig.isPending}
      />
    </div>
  );
}
