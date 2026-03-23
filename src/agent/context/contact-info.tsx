import { useTranslation } from 'react-i18next';
import { Copy, Check, User, Phone, Mail, Building2, Globe, MessageSquare } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useContact } from '@/core/api/hooks/use-contacts';

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

export function ContactInfo() {
  const { t } = useTranslation(['agent']);
  const selectedId = useConversationStore((s) => s.selectedId);
  const conversations = useConversationStore((s) => s.conversations);

  const conversation = selectedId ? conversations[selectedId] : null;
  const contactId = conversation?.contactId;
  const { data: contact } = useContact(contactId);

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
    </div>
  );
}
