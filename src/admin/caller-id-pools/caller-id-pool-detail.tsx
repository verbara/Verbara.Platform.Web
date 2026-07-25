import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { PageHeader } from '@/core/ui/page-header';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import {
  useCallerIdPool,
  useCallerIdPoolEntries,
  useAddPoolEntry,
  useRemovePoolEntry,
} from '@/core/api/hooks/use-caller-id-pools';
import { useFormatPhone } from '@/core/i18n/use-format-phone';

interface AddEntryForm {
  phoneNumber: string;
  areaCode: string;
}

const DEFAULT_FORM: AddEntryForm = { phoneNumber: '', areaCode: '' };

export default function CallerIdPoolDetailPage() {
  const { t } = useTranslation('admin');
  const { formatPhone } = useFormatPhone();
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const poolIdNum = Number(poolId);

  const { data: pool, isLoading: poolLoading } = useCallerIdPool(poolIdNum);
  const { data: entries = [], isLoading: entriesLoading } = useCallerIdPoolEntries(poolIdNum);

  const addEntry = useAddPoolEntry();
  const removeEntry = useRemovePoolEntry();

  const [form, setForm] = useState<AddEntryForm>(DEFAULT_FORM);

  const isLoading = poolLoading || entriesLoading;

  if (isLoading) {
    return <PageSkeleton variant="form" />;
  }

  if (!pool) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('caller-id-pools.detail.not_found')}
      </div>
    );
  }

  const handleAdd = () => {
    if (!form.phoneNumber.trim()) return;
    addEntry.mutate(
      {
        poolId: poolIdNum,
        phoneNumber: form.phoneNumber.trim(),
        areaCode: form.areaCode.trim(),
        isActive: true,
      },
      { onSuccess: () => setForm(DEFAULT_FORM) },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/caller-id-pools')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t('caller-id-pools.detail.back')}
      </Button>

      {/* Header */}
      <PageHeader title={pool.name} description={t('caller-id-pools.detail.description')} />

      {/* Add entry form */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('caller-id-pools.detail.add_entry')}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px] space-y-1.5">
            <Label htmlFor="phoneNumber">{t('caller-id-pools.detail.phone_number')}</Label>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              placeholder="+15551234567"
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="areaCode">{t('caller-id-pools.detail.area_code')}</Label>
            <Input
              id="areaCode"
              value={form.areaCode}
              onChange={(e) => setForm((f) => ({ ...f, areaCode: e.target.value }))}
              placeholder="555"
            />
          </div>
          <Button onClick={handleAdd} disabled={addEntry.isPending || !form.phoneNumber.trim()}>
            <Plus className="mr-1.5 h-4 w-4" />
            {addEntry.isPending
              ? t('caller-id-pools.detail.adding')
              : t('caller-id-pools.detail.add')}
          </Button>
        </div>
      </div>

      {/* Entries table */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('caller-id-pools.detail.entries_title', { count: entries.length })}
        </p>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('caller-id-pools.detail.no_entries')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('caller-id-pools.detail.col_phone')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('caller-id-pools.detail.col_area_code')}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                    {t('caller-id-pools.detail.col_active')}
                  </th>
                  <th className="px-3 py-2" aria-label={t('common:table.col_actions')} />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-sm">
                      {formatPhone(entry.phoneNumber)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{entry.areaCode}</td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={entry.isActive}
                        disabled
                        aria-label={t('caller-id-pools.detail.active_aria')}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeEntry.mutate({ poolId: poolIdNum, entryId: entry.id })}
                        disabled={removeEntry.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
