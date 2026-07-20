import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, CircleCheck, CircleX } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import { DncImportWizard } from './dnc-import-wizard';
import {
  useDncList,
  useDncEntries,
  useAddDncEntry,
  useRemoveDncEntry,
  useImportDncEntries,
  useCheckDncNumber,
  type DncEntry,
} from '@/core/api/hooks/use-dnc-lists';
import { useFormatDate } from '@/core/i18n/use-format';
import { useFormatPhone } from '@/core/i18n/use-format-phone';

const PAGE_SIZE = 50;

/** Parse phone numbers from a plain CSV (one per line or one per column). */
function parsePhonesFromCsv(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const phones: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Split by comma, take first token, strip quotes
    const cell = line.split(',')[0]?.replace(/"/g, '').trim() ?? '';
    if (!cell || cell.toLowerCase() === 'phone' || cell.toLowerCase() === 'phonenumber') continue;
    if (!seen.has(cell)) {
      seen.add(cell);
      phones.push(cell);
    }
  }

  return phones;
}

export default function DncListDetail() {
  const { t } = useTranslation('admin');
  const { formatDateShort } = useFormatDate();
  const { formatPhone } = useFormatPhone();
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();

  const listIdNum = Number(listId);

  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data: list, isLoading: listLoading } = useDncList(listIdNum);
  const { data: entries = [], isLoading: entriesLoading } = useDncEntries(
    listIdNum,
    offset,
    PAGE_SIZE,
  );

  const addEntry = useAddDncEntry();
  const removeEntry = useRemoveDncEntry();
  const importEntries = useImportDncEntries();
  const checkNumber = useCheckDncNumber();

  const [addPhone, setAddPhone] = useState('');
  const [addReason, setAddReason] = useState('');
  const [checkPhone, setCheckPhone] = useState('');
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddEntry = () => {
    if (!addPhone.trim()) return;
    addEntry.mutate(
      { listId: listIdNum, phoneNumber: addPhone.trim(), reason: addReason.trim() || undefined },
      {
        onSuccess: () => {
          setAddPhone('');
          setAddReason('');
        },
      },
    );
  };

  const handleCheck = () => {
    if (!checkPhone.trim()) return;
    checkNumber.mutate({ listId: listIdNum, phoneNumber: checkPhone.trim() });
  };

  const handleConfirmDelete = () => {
    if (deletingEntryId === null) return;
    removeEntry.mutate(
      { listId: listIdNum, entryId: deletingEntryId },
      { onSuccess: () => setDeletingEntryId(null) },
    );
  };

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const phones = parsePhonesFromCsv(text);
        if (phones.length === 0) return;
        const entries = phones.map((phoneNumber) => ({ phoneNumber }));
        importEntries.mutate({ listId: listIdNum, entries });
      };
      reader.readAsText(file);
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [listIdNum, importEntries],
  );

  if (listLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('dnc-lists.detail.loading')}
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('dnc-lists.detail.not_found')}
      </div>
    );
  }

  const checkResult = checkNumber.data;
  const hasNextPage = entries.length === PAGE_SIZE;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dnc-lists')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t('dnc-lists.detail.back')}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">{list.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground capitalize">
            {t('dnc-lists.detail.scope_summary', { scope: list.scope, count: list.entryCount })}
          </p>
        </div>
        <PermissionButton
          requires="campaigns:dnc:manage"
          size="sm"
          variant="outline"
          onClick={() => setImportWizardOpen(true)}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          {t('dnc-lists.detail.import_numbers')}
        </PermissionButton>
      </div>

      {/* Add Number */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('dnc-lists.detail.add_number')}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="add-phone">{t('dnc-lists.detail.phone_label')}</Label>
            <Input
              id="add-phone"
              placeholder={t('dnc-lists.detail.phone_placeholder')}
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddEntry();
              }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="add-reason">{t('dnc-lists.detail.reason_label')}</Label>
            <Input
              id="add-reason"
              placeholder={t('dnc-lists.detail.reason_placeholder')}
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddEntry();
              }}
            />
          </div>
          <Button onClick={handleAddEntry} disabled={!addPhone.trim() || addEntry.isPending}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('dnc-lists.detail.add')}
          </Button>
        </div>
      </div>

      {/* Check Number */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('dnc-lists.detail.check_number')}
        </p>
        <div className="flex gap-2">
          <Input
            placeholder={t('dnc-lists.detail.phone_placeholder')}
            value={checkPhone}
            onChange={(e) => setCheckPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCheck();
            }}
          />
          <Button
            variant="outline"
            onClick={handleCheck}
            disabled={!checkPhone.trim() || checkNumber.isPending}
          >
            {t('dnc-lists.detail.check')}
          </Button>
        </div>

        {checkResult && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
              checkResult.isBlocked
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {checkResult.isBlocked ? (
              <>
                <CircleX className="h-4 w-4 shrink-0" />
                <span>
                  <Trans
                    i18nKey="dnc-lists.detail.blocked_message"
                    ns="admin"
                    values={{ phone: formatPhone(checkResult.phoneNumber) }}
                    components={[<strong key="phone" />]}
                  />
                  {checkResult.matchedListName &&
                    t('dnc-lists.detail.blocked_by_list', { list: checkResult.matchedListName })}
                  .
                </span>
              </>
            ) : (
              <>
                <CircleCheck className="h-4 w-4 shrink-0" />
                <span>
                  <Trans
                    i18nKey="dnc-lists.detail.not_blocked"
                    ns="admin"
                    values={{ phone: formatPhone(checkResult.phoneNumber) }}
                    components={[<strong key="phone" />]}
                  />
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Entries Table */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('dnc-lists.detail.entries')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importEntries.isPending}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {importEntries.isPending
              ? t('dnc-lists.detail.importing')
              : t('dnc-lists.detail.import_csv')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {entriesLoading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            {t('dnc-lists.detail.loading_entries')}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dnc-lists.detail.no_entries')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('dnc-lists.detail.col_phone')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('dnc-lists.detail.col_reason')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('dnc-lists.detail.col_expires')}
                  </th>
                  <th className="px-3 py-2" aria-label={t('common:table.col_actions')} />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: DncEntry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatPhone(entry.phoneNumber)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {entry.reason ?? <span className="italic text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {entry.expiresAt ? (
                        formatDateShort(entry.expiresAt)
                      ) : (
                        <span className="italic text-muted-foreground/50">
                          {t('dnc-lists.detail.expires_never')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeletingEntryId(entry.id)}
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

        {/* Pagination */}
        {(page > 0 || hasNextPage) && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              {t('dnc-lists.detail.previous')}
            </Button>
            <span>{t('dnc-lists.detail.page_n', { n: page + 1 })}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              {t('dnc-lists.detail.next')}
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deletingEntryId !== null}
        onOpenChange={(o) => {
          if (!o) setDeletingEntryId(null);
        }}
        title={t('dnc-lists.detail.remove_dialog.title')}
        description={t('dnc-lists.detail.remove_dialog.description')}
        onConfirm={handleConfirmDelete}
        confirmLabel={t('dnc-lists.detail.remove_dialog.confirm')}
        variant="destructive"
      />

      <DncImportWizard
        listId={listIdNum}
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
      />
    </div>
  );
}
