import { useTranslation } from 'react-i18next';
import { Copy, Check, User, Phone, Mail, Building2, Globe, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/ui/dialog';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useContact, useUpdateContact, useDeleteContact } from '@/core/api/hooks/use-contacts';

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation(['agent']);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success(t('agent:context.copied'));
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value, t]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 inline-flex shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      title={t('agent:context.copy')}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  copyable = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className="flex items-center">
          <p className="truncate text-sm text-slate-700 dark:text-slate-200">{value}</p>
          {copyable && <CopyButton value={value} />}
        </div>
      </div>
    </div>
  );
}

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  webchat: 'Web Chat',
  voice: 'Voice',
  sms: 'SMS',
  telegram: 'Telegram',
};

const languageLabels: Record<string, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

interface ContactEditForm {
  firstName: string;
  lastName: string;
  company: string;
  segment: string;
  preferredChannel: string;
  preferredLanguage: string;
  timezone: string;
}

export function ContactInfo() {
  const { t } = useTranslation(['agent']);
  const selectedId = useConversationStore((s) => s.selectedId);
  const conversations = useConversationStore((s) => s.conversations);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<ContactEditForm>({
    firstName: '', lastName: '', company: '', segment: '',
    preferredChannel: '', preferredLanguage: '', timezone: '',
  });
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const conversation = selectedId ? conversations[selectedId] : null;
  const contactId = conversation?.contactId;
  const { data: contact } = useContact(contactId);

  const openEditDialog = () => {
    if (!contact) return;
    setEditForm({
      firstName: contact.firstName ?? '',
      lastName: contact.lastName ?? '',
      company: contact.company ?? '',
      segment: contact.segment ?? '',
      preferredChannel: contact.preferredChannel ?? '',
      preferredLanguage: contact.preferredLanguage ?? '',
      timezone: contact.timezone ?? '',
    });
    setEditOpen(true);
  };

  if (!contact) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-slate-400">
        {t('agent:context.no_contact')}
      </div>
    );
  }

  const displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—';
  const phone = contact.addresses.find((a) => a.channel === 'voice' || a.channel === 'sms')?.address ?? '—';
  const email = contact.addresses.find((a) => a.channel === 'email')?.address ?? '—';

  return (
    <div className="space-y-1 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Contact</span>
        <div className="flex items-center gap-0.5">
          <PermissionGuard requires="contacts:contact:edit">
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={openEditDialog}>
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </PermissionGuard>
          <PermissionGuard requires="contacts:contact:delete">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-red-500 hover:text-red-600"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </PermissionGuard>
        </div>
      </div>
      <InfoRow icon={User} label={t('agent:context.name')} value={displayName} />
      <InfoRow icon={Phone} label={t('agent:context.phone')} value={phone} copyable={phone !== '—'} />
      <InfoRow icon={Mail} label={t('agent:context.email')} value={email} copyable={email !== '—'} />
      <InfoRow icon={Building2} label={t('agent:context.company')} value={contact.company ?? '—'} />
      <InfoRow
        icon={MessageSquare}
        label={t('agent:context.preferred_channel')}
        value={channelLabels[contact.preferredChannel ?? ''] ?? contact.preferredChannel ?? '—'}
      />
      <InfoRow
        icon={Globe}
        label={t('agent:context.language')}
        value={languageLabels[contact.preferredLanguage ?? ''] ?? contact.preferredLanguage ?? '—'}
      />

      {contact.addresses.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('agent:context.addresses')}
          </p>
          {contact.addresses.map((addr) => (
            <div key={`${addr.channel}-${addr.address}`} className="flex items-center justify-between py-1">
              <span className="text-xs text-slate-500 capitalize">{channelLabels[addr.channel] ?? addr.channel}</span>
              <span className="text-xs text-slate-700 dark:text-slate-300">{addr.address}</span>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          deleteContact.mutate(contact.id, {
            onSuccess: () => setDeleteOpen(false),
          });
        }}
        entityName={[contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.id}
        entityType="Contact"
        isPending={deleteContact.isPending}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input id="edit-firstName" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input id="edit-lastName" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-company">Company</Label>
              <Input id="edit-company" value={editForm.company} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-segment">Segment</Label>
              <Input id="edit-segment" value={editForm.segment} onChange={(e) => setEditForm((f) => ({ ...f, segment: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-prefChannel">Preferred Channel</Label>
              <Input id="edit-prefChannel" value={editForm.preferredChannel} onChange={(e) => setEditForm((f) => ({ ...f, preferredChannel: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-prefLang">Preferred Language</Label>
              <Input id="edit-prefLang" value={editForm.preferredLanguage} onChange={(e) => setEditForm((f) => ({ ...f, preferredLanguage: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tz">Timezone</Label>
              <Input id="edit-tz" value={editForm.timezone} onChange={(e) => setEditForm((f) => ({ ...f, timezone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={updateContact.isPending}
              onClick={() => {
                if (!contact) return;
                updateContact.mutate({
                  id: contact.id,
                  firstName: editForm.firstName || undefined,
                  lastName: editForm.lastName || undefined,
                  company: editForm.company || undefined,
                  segment: editForm.segment || undefined,
                  preferredChannel: editForm.preferredChannel || undefined,
                  preferredLanguage: editForm.preferredLanguage || undefined,
                  timezone: editForm.timezone || undefined,
                }, {
                  onSuccess: () => setEditOpen(false),
                });
              }}
            >
              {updateContact.isPending ? 'Saving...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
