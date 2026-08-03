import { useTranslation } from 'react-i18next';
import { User, Phone, Mail, Building2, Globe, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { CopyButton } from '@/core/ui/copy-button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { TimezoneSelect } from '@/core/ui/timezone-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionButton } from '@/core/ui/permission-button';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';
import { useContact, useUpdateContact, useDeleteContact } from '@/core/api/hooks/use-contacts';
import { useVoiceDial } from '@/core/api/hooks/use-conversations';
import { useFormatPhone } from '@/core/i18n/use-format-phone';

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
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className="flex items-center">
          <p className="truncate text-sm text-slate-700 dark:text-slate-200">{value}</p>
          {copyable && <CopyButton value={value} iconOnly />}
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
  const { formatPhone } = useFormatPhone();
  const selectedId = useConversationStore((s) => s.selectedId);
  const conversations = useConversationStore((s) => s.conversations);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<ContactEditForm>({
    firstName: '',
    lastName: '',
    company: '',
    segment: '',
    preferredChannel: '',
    preferredLanguage: '',
    timezone: '',
  });
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  // Click-to-dial (3B.2d): only when the softphone is registered and no call is in progress
  // (single-session). The dial response carries the tracked outbound Conversation id.
  const registration = useVoiceCallStore((s) => s.registration);
  const callPhase = useVoiceCallStore((s) => s.phase);
  const startOutbound = useVoiceCallStore((s) => s.startOutbound);
  const dial = useVoiceDial();

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
      <div className="flex items-center justify-center p-6 text-sm text-slate-500">
        {t('agent:context.no_contact')}
      </div>
    );
  }

  const displayName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—';
  const rawPhone =
    contact.addresses.find((a) => a.channel === 'voice' || a.channel === 'sms')?.address ?? '—';
  const phone = rawPhone === '—' ? rawPhone : formatPhone(rawPhone);
  const email = contact.addresses.find((a) => a.channel === 'email')?.address ?? '—';

  return (
    <div className="space-y-1 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Contact</span>
        <div className="flex items-center gap-0.5">
          <PermissionButton
            requires="contacts:contact:edit"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={openEditDialog}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </PermissionButton>
          <PermissionButton
            requires="contacts:contact:delete"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-red-500 hover:text-red-600"
            data-testid="contact-delete-btn"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
          </PermissionButton>
        </div>
      </div>
      <InfoRow icon={User} label={t('agent:context.name')} value={displayName} />
      <InfoRow
        icon={Phone}
        label={t('agent:context.phone')}
        value={phone}
        copyable={phone !== '—'}
      />
      {rawPhone !== '—' && registration === 'registered' && (
        <Button
          data-testid="contact-call-btn"
          variant="outline"
          size="sm"
          className="mt-1 w-full"
          disabled={dial.isPending || callPhase !== 'idle'}
          onClick={() => {
            dial.mutate(
              { toNumber: rawPhone, contactId: contact.id },
              {
                onSuccess: (res) => {
                  if (res.accepted && res.correlationId) {
                    startOutbound({ number: rawPhone, correlationId: res.correlationId });
                  } else {
                    toast.error(t('voice.dial_failed', 'Could not place the call'));
                  }
                },
                onError: () => toast.error(t('voice.dial_failed', 'Could not place the call')),
              },
            );
          }}
        >
          <Phone data-icon="inline-start" />
          {t('voice.call_contact', 'Call')}
        </Button>
      )}
      <InfoRow
        icon={Mail}
        label={t('agent:context.email')}
        value={email}
        copyable={email !== '—'}
      />
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
          {contact.addresses.map((addr) => {
            const isPhoneChannel = addr.channel === 'voice' || addr.channel === 'sms';
            const displayAddress = isPhoneChannel ? formatPhone(addr.address) : addr.address;
            return (
              <div
                key={`${addr.channel}-${addr.address}`}
                className="flex items-center justify-between py-1"
              >
                <span className="text-xs text-slate-500 capitalize">
                  {channelLabels[addr.channel] ?? addr.channel}
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-300">{displayAddress}</span>
              </div>
            );
          })}
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
        entityType={t('context.contact_entity_type')}
        isPending={deleteContact.isPending}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('agent:context.contactEdit.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-firstName">{t('agent:context.contactEdit.firstName')}</Label>
                <Input
                  id="edit-firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lastName">{t('agent:context.contactEdit.lastName')}</Label>
                <Input
                  id="edit-lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-company">{t('agent:context.contactEdit.company')}</Label>
              <Input
                id="edit-company"
                value={editForm.company}
                onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-segment">{t('agent:context.contactEdit.segment')}</Label>
              <Input
                id="edit-segment"
                value={editForm.segment}
                onChange={(e) => setEditForm((f) => ({ ...f, segment: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-prefChannel">
                {t('agent:context.contactEdit.preferredChannel')}
              </Label>
              <Input
                id="edit-prefChannel"
                value={editForm.preferredChannel}
                onChange={(e) => setEditForm((f) => ({ ...f, preferredChannel: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-prefLang">
                {t('agent:context.contactEdit.preferredLanguage')}
              </Label>
              <Input
                id="edit-prefLang"
                value={editForm.preferredLanguage}
                onChange={(e) => setEditForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tz">{t('agent:context.contactEdit.timezone')}</Label>
              <TimezoneSelect
                id="edit-tz"
                value={editForm.timezone}
                onChange={(zone) => setEditForm((f) => ({ ...f, timezone: zone }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              disabled={updateContact.isPending}
              onClick={() => {
                if (!contact) return;
                updateContact.mutate(
                  {
                    id: contact.id,
                    firstName: editForm.firstName || undefined,
                    lastName: editForm.lastName || undefined,
                    company: editForm.company || undefined,
                    segment: editForm.segment || undefined,
                    preferredChannel: editForm.preferredChannel || undefined,
                    preferredLanguage: editForm.preferredLanguage || undefined,
                    timezone: editForm.timezone || undefined,
                  },
                  {
                    onSuccess: () => setEditOpen(false),
                  },
                );
              }}
            >
              {updateContact.isPending
                ? t('agent:context.contactEdit.saving')
                : t('agent:context.contactEdit.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
