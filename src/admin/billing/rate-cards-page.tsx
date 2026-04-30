import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { RateCardForm } from './rate-card-form';
import {
  useRateCards,
  useDeleteRateCard,
  type RateCard,
} from '@/core/api/hooks/use-billing';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useAuthStore } from '@/core/auth/auth-store';

const col = createColumnHelper<RateCard>();

export default function RateCardsPage() {
  const { t } = useTranslation('admin');
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const authTenantId = useAuthStore((s) => s.tenantId);
  const tenantId = activeTenantId ?? authTenantId;
  const { data: rateCards = [] } = useRateCards();
  const deleteRateCard = useDeleteRateCard();

  const [createOpen, setCreateOpen] = useState(false);
  const [editCard, setEditCard] = useState<RateCard | undefined>();
  const [deleteCard, setDeleteCard] = useState<RateCard | undefined>();

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: () => t('billing.rate_cards.columns.name'),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      col.accessor('currency', {
        header: () => t('billing.rate_cards.columns.currency'),
        cell: (info) => info.getValue(),
      }),
      col.accessor('isDefault', {
        header: () => t('billing.rate_cards.columns.default'),
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="default">{t('billing.rate_cards.default_badge')}</Badge>
          ) : null,
      }),
      col.accessor('effectiveFrom', {
        header: () => t('billing.rate_cards.columns.effective_from'),
        cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
      }),
      col.accessor('effectiveTo', {
        header: () => t('billing.rate_cards.columns.effective_to'),
        cell: (info) =>
          info.getValue() ? format(new Date(info.getValue()!), 'MMM d, yyyy') : '—',
      }),
      col.accessor('rates', {
        header: () => t('billing.rate_cards.columns.rates'),
        cell: (info) => (
          <span className="text-muted-foreground">
            {t('billing.rate_cards.entries_count', { count: info.getValue().length })}
          </span>
        ),
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              data-testid={`edit-rate-card-${row.original.rateCardId}`}
              onClick={(e) => {
                e.stopPropagation();
                setEditCard(row.original);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              data-testid={`delete-rate-card-${row.original.rateCardId}`}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteCard(row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [t],
  );

  if (!tenantId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground" data-testid="no-tenant-message">
          <Trans
            i18nKey="billing.select_tenant_rate_cards_prefix"
            ns="admin"
          />
          <a href="/admin/tenants" className="text-brand underline">{t('billing.tenants_link')}</a>
          <Trans
            i18nKey="billing.select_tenant_rate_cards_suffix"
            ns="admin"
          />
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="rate-cards-page">
      <PageHeader title={t('billing.rate_cards.title')} description={t('billing.rate_cards.description')}>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-rate-card">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('billing.rate_cards.new')}
        </Button>
      </PageHeader>

      <DataTable
        data={rateCards}
        columns={columns}
        searchPlaceholder={t('billing.rate_cards.search_placeholder')}
      />

      <RateCardForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      <RateCardForm
        open={!!editCard}
        onOpenChange={(open) => { if (!open) setEditCard(undefined); }}
        mode="edit"
        rateCard={editCard}
      />

      <ConfirmDeleteDialog
        open={!!deleteCard}
        onOpenChange={(open) => { if (!open) setDeleteCard(undefined); }}
        onConfirm={() => {
          if (deleteCard) deleteRateCard.mutate(deleteCard.rateCardId);
          setDeleteCard(undefined);
        }}
        entityName={deleteCard?.name ?? ''}
        entityType={t('billing.rate_cards.entity_label')}
        isPending={deleteRateCard.isPending}
      />
    </div>
  );
}
