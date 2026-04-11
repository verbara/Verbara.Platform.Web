import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
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
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();

  const listIdNum = Number(listId);

  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data: list, isLoading: listLoading } = useDncList(listIdNum);
  const { data: entries = [], isLoading: entriesLoading } = useDncEntries(listIdNum, offset, PAGE_SIZE);

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
        Loading…
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        DNC list not found.
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
          DNC Lists
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">{list.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground capitalize">
            Scope: {list.scope} &middot; {list.entryCount.toLocaleString()} entries
          </p>
        </div>
        <PermissionGuard requires="campaigns:dnc:manage">
          <Button size="sm" variant="outline" onClick={() => setImportWizardOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Import Numbers
          </Button>
        </PermissionGuard>
      </div>

      {/* Add Number */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add Number
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="add-phone">Phone number</Label>
            <Input
              id="add-phone"
              placeholder="+1 555 000 0000"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntry(); }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="add-reason">Reason (optional)</Label>
            <Input
              id="add-reason"
              placeholder="e.g. Customer opt-out"
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntry(); }}
            />
          </div>
          <Button
            onClick={handleAddEntry}
            disabled={!addPhone.trim() || addEntry.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Check Number */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Check Number
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="+1 555 000 0000"
            value={checkPhone}
            onChange={(e) => setCheckPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
          />
          <Button
            variant="outline"
            onClick={handleCheck}
            disabled={!checkPhone.trim() || checkNumber.isPending}
          >
            Check
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
                <XCircle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{checkResult.phoneNumber}</strong> is blocked
                  {checkResult.matchedListName && ` by list "${checkResult.matchedListName}"`}.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{checkResult.phoneNumber}</strong> is not on any DNC list.
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
            Entries
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importEntries.isPending}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {importEntries.isPending ? 'Importing…' : 'Import CSV'}
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
            Loading entries…
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entries yet. Add numbers individually or import a CSV.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Phone Number
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Reason
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Expires
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: DncEntry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{entry.phoneNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {entry.reason ?? <span className="italic text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {entry.expiresAt
                        ? new Date(entry.expiresAt).toLocaleDateString()
                        : <span className="italic text-muted-foreground/50">Never</span>}
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
              Previous
            </Button>
            <span>Page {page + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deletingEntryId !== null}
        onOpenChange={(o) => { if (!o) setDeletingEntryId(null); }}
        title="Remove DNC Entry"
        description="Are you sure you want to remove this number from the list? It may be dialed again."
        onConfirm={handleConfirmDelete}
        confirmLabel="Remove"
        variant="destructive"
      />

      <DncImportWizard listId={listIdNum} open={importWizardOpen} onOpenChange={setImportWizardOpen} />
    </div>
  );
}
