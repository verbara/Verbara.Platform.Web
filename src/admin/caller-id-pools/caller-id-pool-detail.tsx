import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { PageHeader } from '@/admin/shared/page-header';
import {
  useCallerIdPool,
  useCallerIdPoolEntries,
  useAddPoolEntry,
  useRemovePoolEntry,
} from '@/core/api/hooks/use-caller-id-pools';

interface AddEntryForm {
  phoneNumber: string;
  areaCode: string;
}

const DEFAULT_FORM: AddEntryForm = { phoneNumber: '', areaCode: '' };

export default function CallerIdPoolDetailPage() {
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
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Caller ID pool not found.
      </div>
    );
  }

  const handleAdd = () => {
    if (!form.phoneNumber.trim()) return;
    addEntry.mutate(
      { poolId: poolIdNum, phoneNumber: form.phoneNumber.trim(), areaCode: form.areaCode.trim(), isActive: true },
      { onSuccess: () => setForm(DEFAULT_FORM) },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/caller-id-pools')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to Caller ID Pools
      </Button>

      {/* Header */}
      <PageHeader title={pool.name} description="Manage phone number entries in this pool." />

      {/* Add entry form */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add Entry
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px] space-y-1.5">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              placeholder="+15551234567"
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="areaCode">Area Code</Label>
            <Input
              id="areaCode"
              value={form.areaCode}
              onChange={(e) => setForm((f) => ({ ...f, areaCode: e.target.value }))}
              placeholder="555"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={addEntry.isPending || !form.phoneNumber.trim()}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {addEntry.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Entries table */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Entries ({entries.length})
        </p>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entries yet. Add phone numbers above.
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
                    Area Code
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                    Active
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-sm">{entry.phoneNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground">{entry.areaCode}</td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={entry.isActive}
                        disabled
                        aria-label="Is active"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() =>
                          removeEntry.mutate({ poolId: poolIdNum, entryId: entry.id })
                        }
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
