import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { useSearchContacts, type Contact } from '@/core/api/hooks/use-contacts';
import { useCreateConversation } from '@/core/api/hooks/use-conversations';

const CHANNELS = [
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Sms', label: 'SMS' },
  { value: 'WebChat', label: 'WebChat' },
  { value: 'Email', label: 'Email' },
  { value: 'Messenger', label: 'Messenger' },
  { value: 'Telegram', label: 'Telegram' },
] as const;

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function contactDisplayName(c: Contact): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || 'Unnamed contact';
}

export function NewConversationDialog({ open, onOpenChange }: Readonly<NewConversationDialogProps>) {
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [channel, setChannel] = useState('WhatsApp');
  const [initialMessage, setInitialMessage] = useState('');
  const { data: contacts = [] } = useSearchContacts(contactSearch);
  const createMutation = useCreateConversation();

  function resetForm() {
    setSelectedContact(null);
    setContactSearch('');
    setChannel('WhatsApp');
    setInitialMessage('');
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedContact) return;
    createMutation.mutate(
      {
        contactId: selectedContact.id,
        channel,
        initialMessage: initialMessage.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="new-conversation-form">
          {/* Contact search */}
          <div>
            <Label>Contact</Label>
            {selectedContact ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                <span className="text-sm">{contactDisplayName(selectedContact)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedContact(null)}
                  data-testid="new-conv-change-contact-btn"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div>
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search contacts (min 2 characters)..."
                  data-testid="new-conv-contact-search"
                />
                {contacts.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-input bg-background">
                    {contacts.map((c) => {
                      const primary = c.addresses[0];
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setSelectedContact(c);
                              setContactSearch('');
                            }}
                            data-testid={`new-conv-contact-option-${c.id}`}
                          >
                            <div className="font-medium">{contactDisplayName(c)}</div>
                            {primary && (
                              <div className="text-xs text-muted-foreground">
                                {primary.channel} · {primary.address}
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Channel */}
          <div>
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => v && setChannel(v)}>
              <SelectTrigger className="w-full" data-testid="new-conv-channel-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((ch) => (
                  <SelectItem key={ch.value} value={ch.value}>
                    {ch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Initial message */}
          <div>
            <Label>Initial Message (optional)</Label>
            <Textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Type a message..."
              rows={3}
              data-testid="new-conv-message-input"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!selectedContact || createMutation.isPending}
            data-testid="new-conv-submit-btn"
          >
            Start Conversation
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
