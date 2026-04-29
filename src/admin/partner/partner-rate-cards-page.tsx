import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PartnerRateCardForm } from './partner-rate-card-form';
import { usePartnerRateCards, useDeletePartnerRateCard } from '@/core/api/hooks/use-partner';
import type { RateCard } from '@/core/api/hooks/use-billing';

const col = createColumnHelper<RateCard>();

export default function PartnerRateCardsPage() {
  const { t } = useTranslation('admin');
  const { data: rateCards = [] } = usePartnerRateCards();
  const deleteRc = useDeletePartnerRateCard();

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
        cell: (info) => (info.getValue() ? <Badge variant="default">{t('billing.rate_cards.default_badge')}</Badge> : null),
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
          <span className="text-muted-foreground">{t('billing.rate_cards.entries_count', { count: info.getValue().length })}</span>
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
              data-testid={`edit-partner-rate-card-${row.original.rateCardId}`}
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
              data-testid={`delete-partner-rate-card-${row.original.rateCardId}`}
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

  return (
    <div className="space-y-6" data-testid="partner-rate-cards-page">
      <PageHeader title={t('partner.rate_cards.title')} description={t('partner.rate_cards.description')}>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-partner-rate-card">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('partner.rate_cards.new')}
        </Button>
      </PageHeader>

      <DataTable data={rateCards} columns={columns} searchPlaceholder={t('partner.rate_cards.search_placeholder')} />

      <PartnerRateCardForm open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      <PartnerRateCardForm
        open={!!editCard}
        onOpenChange={(open) => { if (!open) setEditCard(undefined); }}
        mode="edit"
        rateCard={editCard}
      />

      <ConfirmDeleteDialog
        open={!!deleteCard}
        onOpenChange={(open) => { if (!open) setDeleteCard(undefined); }}
        onConfirm={() => {
          if (deleteCard) deleteRc.mutate(deleteCard.rateCardId);
          setDeleteCard(undefined);
        }}
        entityName={deleteCard?.name ?? ''}
        entityType="rate card"
        isPending={deleteRc.isPending}
      />
    </div>
  );
}
