import { useState, useEffect, useMemo } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { Checkbox } from '@/core/ui/checkbox';
import { Switch } from '@/core/ui/switch';
import { Label } from '@/core/ui/label';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/core/ui/sheet';
import { useSearchContacts, useUpdateContact, type Contact } from '@/core/api/hooks/use-contacts';

const CHANNELS = ['voice', 'email', 'sms', 'whatsapp', 'webchat'] as const;

function contactName(c: Contact) {
  return c.firstName || c.lastName ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : 'Unknown';
}

export default function ConsentManagementPage() {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editDnc, setEditDnc] = useState(false);
  const [editChannels, setEditChannels] = useState<Record<string, boolean>>({});
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: contacts = [] } = useSearchContacts(debouncedSearch);
  const updateContact = useUpdateContact();
  const allSelected = useMemo(
    () => contacts.length > 0 && contacts.every((c) => selected.has(c.id)),
    [contacts, selected],
  );

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function openEdit(c: Contact) {
    setEditContact(c);
    setEditDnc(c.doNotContact ?? false);
    setEditChannels(
      CHANNELS.reduce(
        (a, ch) => ({ ...a, [ch]: c.channelConsent?.[ch] ?? false }),
        {} as Record<string, boolean>,
      ),
    );
  }
  function saveConsent() {
    if (!editContact) return;
    updateContact.mutate(
      { id: editContact.id, doNotContact: editDnc, channelConsent: editChannels },
      { onSuccess: () => setEditContact(null) },
    );
  }
  function bulkDnc() {
    selected.forEach((id) => updateContact.mutate({ id, doNotContact: true }));
    setSelected(new Set());
    setShowBulkConfirm(false);
  }

  return (
    <div className="space-y-6" data-testid="consent-management-page">
      <PageHeader title={t('consent.title')} description={t('consent.description')} />

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('consent.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="consent-search"
          />
        </div>
        {selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowBulkConfirm(true)}
            data-testid="bulk-dnc-btn"
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            {t('consent.bulk.setDnc')}
          </Button>
        )}
      </div>

      {contacts.length === 0 && debouncedSearch.length >= 2 ? (
        <p className="py-8 text-center text-sm text-muted-foreground" data-testid="consent-empty">
          {t('consent.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="w-10 p-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="p-3 text-left font-medium">{t('consent.columns.contact')}</th>
                <th className="p-3 text-left font-medium">{t('consent.columns.company')}</th>
                <th className="p-3 text-left font-medium">{t('consent.columns.dnc')}</th>
                <th className="p-3 text-left font-medium">{t('consent.columns.channels')}</th>
                <th className="p-3 text-left font-medium">{t('consent.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                    />
                  </td>
                  <td className="p-3">{contactName(c)}</td>
                  <td className="p-3 text-muted-foreground">{c.company ?? '—'}</td>
                  <td className="p-3">
                    {c.doNotContact && (
                      <Badge variant="destructive" data-testid="dnc-badge">
                        {t('consent.columns.dnc')}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {CHANNELS.map((ch) => (
                        <Badge
                          key={ch}
                          variant={c.channelConsent?.[ch] ? 'default' : 'secondary'}
                          data-testid={`channel-badge-${ch}`}
                        >
                          {t(`consent.channels.${ch}`)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(c)}
                      data-testid="edit-consent-btn"
                    >
                      {t('consent.edit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editContact ? contactName(editContact) : ''}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <Label>{t('consent.dnc.label')}</Label>
              <Switch checked={editDnc} onCheckedChange={setEditDnc} />
            </div>
            {CHANNELS.map((ch) => (
              <div key={ch} className="flex items-center justify-between">
                <Label>{t(`consent.channels.${ch}`)}</Label>
                <Switch
                  checked={editChannels[ch] ?? false}
                  onCheckedChange={(v) => setEditChannels((p) => ({ ...p, [ch]: v }))}
                />
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button onClick={saveConsent} disabled={updateContact.isPending}>
              {t('consent.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDeleteDialog
        open={showBulkConfirm}
        onOpenChange={setShowBulkConfirm}
        onConfirm={bulkDnc}
        entityName={t('consent.bulk.confirm', { count: selected.size })}
        entityType={t('consent.dnc.label')}
        isPending={updateContact.isPending}
      />
    </div>
  );
}
