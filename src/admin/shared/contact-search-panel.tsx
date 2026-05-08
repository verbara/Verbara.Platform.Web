import { useState, useEffect } from 'react';
import { Search, User, Phone, Mail, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { useSearchContacts, type Contact } from '@/core/api/hooks/use-contacts';

export function ContactSearchPanel() {
  const { t } = useTranslation('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults = [], isLoading: searching } = useSearchContacts(debouncedQuery);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('shared.contact_search.placeholder')}
          aria-label={t('shared.contact_search.placeholder')}
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {debouncedQuery.length >= 2 && (
        <div className="space-y-2">
          {searching && (
            <p className="py-4 text-sm text-muted-foreground">
              {t('shared.contact_search.searching')}
            </p>
          )}
          {!searching && searchResults.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              {t('shared.contact_search.no_results', { query: debouncedQuery })}
            </p>
          )}
          {searchResults.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </div>
      )}

      {debouncedQuery.length > 0 && debouncedQuery.length < 2 && (
        <p className="text-xs text-muted-foreground">{t('shared.contact_search.min_chars_hint')}</p>
      )}
    </div>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const { t } = useTranslation('admin');
  const displayName =
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
    t('shared.contact_search.unknown');
  const phone = contact.addresses.find(
    (a) => a.channel === 'voice' || a.channel === 'sms',
  )?.address;
  const email = contact.addresses.find((a) => a.channel === 'email')?.address;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {phone}
            </span>
          )}
          {email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {email}
            </span>
          )}
          {contact.company && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {contact.company}
            </span>
          )}
        </div>
      </div>
      {contact.segment && <Badge variant="outline">{contact.segment}</Badge>}
    </div>
  );
}
