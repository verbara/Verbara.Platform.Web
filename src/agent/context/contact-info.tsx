import { useTranslation } from 'react-i18next';
import { Copy, Check, User, Phone, Mail, Building2, Globe, MessageSquare } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useConversationStore } from '@/agent/stores/conversation-store';

interface Contact {
  name: string;
  phone: string;
  email: string;
  company: string;
  channel: string;
  language: string;
  addresses: Record<string, string>;
}

const MOCK_CONTACTS: Record<string, Contact> = {
  'c-101': {
    name: 'Ana Martinez',
    phone: '+57 300 123 4567',
    email: 'ana.martinez@example.com',
    company: 'Acme Corp',
    channel: 'whatsapp',
    language: 'es',
    addresses: { whatsapp: '+57 300 123 4567', email: 'ana.martinez@example.com' },
  },
  'c-102': {
    name: 'Carlos Rivera',
    phone: '+57 311 987 6543',
    email: 'carlos.rivera@example.com',
    company: 'TechStart SAS',
    channel: 'email',
    language: 'es',
    addresses: { email: 'carlos.rivera@example.com' },
  },
  'c-103': {
    name: 'Laura Chen',
    phone: '+1 415 555 0198',
    email: 'laura.chen@example.com',
    company: 'GlobalTech Inc',
    channel: 'webchat',
    language: 'en',
    addresses: { webchat: 'laura.chen', email: 'laura.chen@example.com' },
  },
  'c-104': {
    name: 'Pedro Gomez',
    phone: '+57 320 456 7890',
    email: 'pedro.gomez@example.com',
    company: 'Distribuciones del Valle',
    channel: 'voice',
    language: 'es',
    addresses: { voice: '+57 320 456 7890', email: 'pedro.gomez@example.com' },
  },
  'c-105': {
    name: 'Sofia Nguyen',
    phone: '+1 212 555 0147',
    email: 'sofia.nguyen@example.com',
    company: 'Bright Solutions',
    channel: 'sms',
    language: 'en',
    addresses: { sms: '+1 212 555 0147', email: 'sofia.nguyen@example.com' },
  },
  'c-106': {
    name: 'Diego Fernandez',
    phone: '+54 911 2345 6789',
    email: 'diego.fernandez@example.com',
    company: 'MediosPay AR',
    channel: 'telegram',
    language: 'es',
    addresses: { telegram: '@diego_f', email: 'diego.fernandez@example.com' },
  },
};

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

export function ContactInfo() {
  const { t } = useTranslation(['agent']);
  const selectedId = useConversationStore((s) => s.selectedId);
  const conversations = useConversationStore((s) => s.conversations);

  const conversation = selectedId ? conversations[selectedId] : null;
  const contact = conversation ? MOCK_CONTACTS[conversation.contactId] : null;

  if (!contact) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-slate-400">
        {t('agent:context.no_contact')}
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

  return (
    <div className="space-y-1 p-4">
      <InfoRow icon={User} label={t('agent:context.name')} value={contact.name} />
      <InfoRow icon={Phone} label={t('agent:context.phone')} value={contact.phone} copyable />
      <InfoRow icon={Mail} label={t('agent:context.email')} value={contact.email} copyable />
      <InfoRow icon={Building2} label={t('agent:context.company')} value={contact.company} />
      <InfoRow
        icon={MessageSquare}
        label={t('agent:context.preferred_channel')}
        value={channelLabels[contact.channel] ?? contact.channel}
      />
      <InfoRow
        icon={Globe}
        label={t('agent:context.language')}
        value={languageLabels[contact.language] ?? contact.language}
      />

      {Object.keys(contact.addresses).length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('agent:context.addresses')}
          </p>
          {Object.entries(contact.addresses).map(([ch, addr]) => (
            <div key={ch} className="flex items-center justify-between py-1">
              <span className="text-xs text-slate-500 capitalize">{channelLabels[ch] ?? ch}</span>
              <span className="text-xs text-slate-700 dark:text-slate-300">{addr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
