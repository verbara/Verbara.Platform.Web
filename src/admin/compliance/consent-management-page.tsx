import { useState, useEffect, useMemo } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/core/ui/page-header';
import { Button } from '@/core/ui/button';
import { PermissionButton } from '@/core/ui/permission-button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { Checkbox } from '@/core/ui/checkbox';
import { Switch } from '@/core/ui/switch';
import { Label } from '@/core/ui/label';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/core/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useSearchContacts, useUpdateContact, type Contact } from '@/core/api/hooks/use-contacts';
import { CHANNEL_TYPES, type ChannelType } from '@/core/api/channel-types';

/** The permission every write of this page needs (`contact-write-refusals.v1.json` `permissionByRoute`, `PUT`). */
const EDIT_PERMISSION = 'contacts:contact:edit';

/** The label key of each channel name, as Platform writes it; the five older keys are kept. */
const CHANNEL_LABEL_KEYS: Record<ChannelType, string> = {
  Voice: 'consent.channels.voice',
  WhatsApp: 'consent.channels.whatsapp',
  Sms: 'consent.channels.sms',
  WebChat: 'consent.channels.webchat',
  Email: 'consent.channels.email',
  Messenger: 'consent.channels.messenger',
  Instagram: 'consent.channels.instagram',
  Telegram: 'consent.channels.telegram',
  Twitter: 'consent.channels.twitter',
  Video: 'consent.channels.video',
  Rcs: 'consent.channels.rcs',
};

/**
 * A channel's recorded answer: `true` is "yes", `false` is "no", and a channel absent from
 * `channelConsent` has no recorded answer, which is not the same as "no".
 */
type ConsentState = 'yes' | 'no' | 'unrecorded';

const STATE_LABEL_KEYS: Record<ConsentState, string> = {
  yes: 'consent.states.yes',
  no: 'consent.states.no',
  unrecorded: 'consent.states.unrecorded',
};

const BADGE_VARIANTS: Record<ConsentState, 'default' | 'destructive' | 'outline'> = {
  yes: 'default',
  no: 'destructive',
  unrecorded: 'outline',
};

function consentState(consent: Contact['channelConsent'], channel: ChannelType): ConsentState {
  if (!consent || !Object.hasOwn(consent, channel)) return 'unrecorded';
  return consent[channel] ? 'yes' : 'no';
}

function consentStates(c: Contact): Record<ChannelType, ConsentState> {
  return Object.fromEntries(
    CHANNEL_TYPES.map((ch) => [ch, consentState(c.channelConsent, ch)]),
  ) as Record<ChannelType, ConsentState>;
}

/**
 * The channels whose selected answer differs from the one the sheet opened with, as booleans.
 * A channel can only leave "no record", never return to it, so every changed value is yes or no.
 */
function changedConsent(
  opened: Record<ChannelType, ConsentState>,
  selected: Record<ChannelType, ConsentState>,
): Partial<Record<ChannelType, boolean>> {
  const changed: Partial<Record<ChannelType, boolean>> = {};
  for (const ch of CHANNEL_TYPES) {
    const value = selected[ch];
    if (value !== opened[ch] && value !== 'unrecorded') changed[ch] = value === 'yes';
  }
  return changed;
}

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
  const [openedChannels, setOpenedChannels] = useState<Record<ChannelType, ConsentState> | null>(
    null,
  );
  const [editChannels, setEditChannels] = useState<Record<ChannelType, ConsentState> | null>(null);
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
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function openEdit(c: Contact) {
    const states = consentStates(c);
    setEditContact(c);
    setEditDnc(c.doNotContact ?? false);
    setOpenedChannels(states);
    setEditChannels(states);
  }
  function saveConsent() {
    if (!editContact || !openedChannels || !editChannels) return;
    const channelConsent = changedConsent(openedChannels, editChannels);
    updateContact.mutate(
      {
        id: editContact.id,
        doNotContact: editDnc,
        ...(Object.keys(channelConsent).length > 0 ? { channelConsent } : {}),
      },
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
          <PermissionButton
            requires={EDIT_PERMISSION}
            variant="destructive"
            size="sm"
            onClick={() => setShowBulkConfirm(true)}
            data-testid="bulk-dnc-btn"
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            {t('consent.bulk.setDnc')}
          </PermissionButton>
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
                      {CHANNEL_TYPES.map((ch) => {
                        const state = consentState(c.channelConsent, ch);
                        const label = `${t(CHANNEL_LABEL_KEYS[ch])}: ${t(STATE_LABEL_KEYS[state])}`;
                        return (
                          <Badge
                            key={ch}
                            variant={BADGE_VARIANTS[state]}
                            data-testid={`channel-badge-${ch}`}
                            data-consent={state}
                            title={label}
                            aria-label={label}
                          >
                            {t(CHANNEL_LABEL_KEYS[ch])}
                          </Badge>
                        );
                      })}
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
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <div className="flex items-center justify-between">
              <Label>{t('consent.dnc.label')}</Label>
              <Switch checked={editDnc} onCheckedChange={setEditDnc} />
            </div>
            {openedChannels &&
              editChannels &&
              CHANNEL_TYPES.map((ch) => {
                const value = editChannels[ch];
                // "No record" is offered only while nothing is recorded: the console never resets an answer.
                const states: ConsentState[] =
                  openedChannels[ch] === 'unrecorded' ? ['yes', 'no', 'unrecorded'] : ['yes', 'no'];
                return (
                  <div key={ch} className="flex items-center justify-between gap-3">
                    <Label>{t(CHANNEL_LABEL_KEYS[ch])}</Label>
                    <Select
                      value={value}
                      onValueChange={(next) => {
                        if (next === null) return;
                        setEditChannels((prev) => (prev ? { ...prev, [ch]: next } : prev));
                      }}
                    >
                      <SelectTrigger
                        className="w-36"
                        aria-label={t(CHANNEL_LABEL_KEYS[ch])}
                        data-testid={`consent-channel-${ch}`}
                        data-consent={value}
                      >
                        <SelectValue>
                          {(v: ConsentState | null) => (v ? t(STATE_LABEL_KEYS[v]) : '')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((state) => (
                          <SelectItem
                            key={state}
                            value={state}
                            data-testid={`consent-channel-${ch}-option-${state}`}
                          >
                            {t(STATE_LABEL_KEYS[state])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
          </div>
          <SheetFooter>
            <PermissionButton
              requires={EDIT_PERMISSION}
              onClick={saveConsent}
              disabled={updateContact.isPending}
              data-testid="consent-save-btn"
            >
              {t('consent.save')}
            </PermissionButton>
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
