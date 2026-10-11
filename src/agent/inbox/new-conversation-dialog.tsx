import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/core/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { useSearchContacts, type Contact } from '@/core/api/hooks/use-contacts';
import {
  useCreateConversation,
  type CreateConversationInput,
} from '@/core/api/hooks/use-conversations';
import { describeApiError } from '@/core/api/api-error';
import { conversationRefusals, startRefusalOf } from '@/core/api/conversation-refusals';
import { useAuthStore } from '@/core/auth/auth-store';
import { useFormatPhone } from '@/core/i18n/use-format-phone';

/** Platform's default when a template names no language (`CreateConversationRequest`). */
const DEFAULT_TEMPLATE_LANGUAGE = 'en_US';

/** The permission that opens the supervisor monitor, where another owner's conversation is viewed. */
const MONITOR_PERMISSION = 'contacts:conversation:monitor';

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

export function NewConversationDialog({
  open,
  onOpenChange,
}: Readonly<NewConversationDialogProps>) {
  const { t } = useTranslation('agent');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const mayMonitor = useAuthStore((s) => s.permissions.includes(MONITOR_PERMISSION));
  const { formatPhone } = useFormatPhone();
  const [contactSearch, setContactSearch] = useState('');

  function contactDisplayName(c: Contact): string {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
    return name || t('new_conversation.unnamed_contact');
  }

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [channel, setChannel] = useState('WhatsApp');
  const [initialMessage, setInitialMessage] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState(DEFAULT_TEMPLATE_LANGUAGE);
  // Set when Platform answers `whatsapp-template-required`; the template name input takes focus on
  // the next commit (the callback ref below), whether or not the fields were already shown.
  const focusTemplateRef = useRef(false);
  const { data: contacts = [] } = useSearchContacts(contactSearch);
  const createMutation = useCreateConversation({ reportErrors: 'inline' });

  const isWhatsApp = channel === 'WhatsApp';
  const message = initialMessage.trim();
  // The refusal is shown in the dialog (ADR-0013: from the machine code, never Platform's text).
  const refusalError = createMutation.error;
  const refusal = refusalError
    ? describeApiError(refusalError, conversationRefusals, 'create')
    : null;
  const refusedStart = startRefusalOf(refusalError);
  const ownConversationId =
    refusedStart?.code === 'conversation-not-sendable' ? refusedStart.conversationId : null;
  const elsewhereConversationId =
    refusedStart?.code === 'conversation-open-elsewhere' && mayMonitor
      ? refusedStart.conversationId
      : null;

  function resetForm() {
    setSelectedContact(null);
    setContactSearch('');
    setChannel('WhatsApp');
    setInitialMessage('');
    setTemplateOpen(false);
    setTemplateName('');
    setTemplateLanguage(DEFAULT_TEMPLATE_LANGUAGE);
    createMutation.reset();
  }

  // A refusal belongs to the contact it was answered for: picking another one (or going back to
  // the search) drops it, with its link to that contact's conversation.
  function chooseContact(contact: Contact | null) {
    setSelectedContact(contact);
    createMutation.reset();
  }

  function closeAndGo(path: string) {
    resetForm();
    onOpenChange(false);
    void navigate(path);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedContact || message === '') return;
    const request: CreateConversationInput = {
      contactId: selectedContact.id,
      channel,
      initialMessage: message,
    };
    const template = templateName.trim();
    if (isWhatsApp && templateOpen && template !== '') {
      request.templateName = template;
      request.templateLanguage = templateLanguage.trim() || DEFAULT_TEMPLATE_LANGUAGE;
    }
    createMutation.mutate(request, {
      // A 201 is a new conversation or the caller's own open one reused: open it either way.
      onSuccess: (conversation) => closeAndGo(`/agent/conversation/${conversation.conversationId}`),
      onError: (err) => {
        if (startRefusalOf(err)?.code === 'whatsapp-template-required') {
          focusTemplateRef.current = true;
          setTemplateOpen(true);
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('new_conversation.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="new-conversation-form">
          {/* Contact search */}
          <div>
            <Label>{t('new_conversation.contact')}</Label>
            {selectedContact ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                <span className="text-sm">{contactDisplayName(selectedContact)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => chooseContact(null)}
                  data-testid="new-conv-change-contact-btn"
                >
                  {t('new_conversation.change')}
                </Button>
              </div>
            ) : (
              <div>
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder={t('new_conversation.search_placeholder')}
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
                              chooseContact(c);
                              setContactSearch('');
                            }}
                            data-testid={`new-conv-contact-option-${c.id}`}
                          >
                            <div className="font-medium">{contactDisplayName(c)}</div>
                            {primary && (
                              <div className="text-xs text-muted-foreground">
                                {primary.channel} ·{' '}
                                {primary.channel === 'voice' || primary.channel === 'sms'
                                  ? formatPhone(primary.address)
                                  : primary.address}
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
            <Label>{t('new_conversation.channel')}</Label>
            <Select
              value={channel}
              onValueChange={(v) => {
                if (!v) return;
                setChannel(v);
                createMutation.reset();
              }}
            >
              <SelectTrigger className="w-full" data-testid="new-conv-channel-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((ch) => (
                  <SelectItem
                    key={ch.value}
                    value={ch.value}
                    data-testid={`new-conv-channel-option-${ch.value}`}
                  >
                    {ch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Initial message (required since Platform 2.28.0: the start without one is deprecated) */}
          <div>
            <Label htmlFor="new-conv-message">{t('new_conversation.initial_message')}</Label>
            <Textarea
              id="new-conv-message"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder={t('new_conversation.message_placeholder')}
              rows={3}
              required
              data-testid="new-conv-message-input"
            />
          </div>

          {/* WhatsApp template: needed when the contact has not written in the last 24 hours */}
          {isWhatsApp && (
            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-expanded={templateOpen}
                onClick={() => setTemplateOpen((o) => !o)}
                data-testid="new-conv-template-toggle"
              >
                {t('new_conversation.template_toggle')}
              </Button>
              {templateOpen && (
                <div className="space-y-2 rounded-md border border-input p-3">
                  <div>
                    <Label htmlFor="new-conv-template-name">
                      {t('new_conversation.template_name')}
                    </Label>
                    <Input
                      id="new-conv-template-name"
                      ref={(el) => {
                        if (el && focusTemplateRef.current) {
                          focusTemplateRef.current = false;
                          el.focus();
                        }
                      }}
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder={t('new_conversation.template_name_placeholder')}
                      data-testid="new-conv-template-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-conv-template-language">
                      {t('new_conversation.template_language')}
                    </Label>
                    <Input
                      id="new-conv-template-language"
                      value={templateLanguage}
                      onChange={(e) => setTemplateLanguage(e.target.value)}
                      data-testid="new-conv-template-language"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('new_conversation.template_hint')}
                  </p>
                </div>
              )}
            </div>
          )}

          {refusal && (
            <div
              role="alert"
              className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              data-testid="new-conv-error"
              data-error-code={refusal.code}
            >
              <p>{tCommon(refusal.key)}</p>
              {ownConversationId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => closeAndGo(`/agent/conversation/${ownConversationId}`)}
                  data-testid="new-conv-open-conversation"
                >
                  {t('new_conversation.open_conversation')}
                </Button>
              )}
              {elsewhereConversationId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    closeAndGo(
                      `/operations/monitor?${new URLSearchParams({
                        tab: 'digital',
                        conversation: elsewhereConversationId,
                      }).toString()}`,
                    )
                  }
                  data-testid="new-conv-view-open-conversation"
                >
                  {t('new_conversation.view_open_conversation')}
                </Button>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!selectedContact || message === '' || createMutation.isPending}
            data-testid="new-conv-submit-btn"
          >
            {t('new_conversation.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
