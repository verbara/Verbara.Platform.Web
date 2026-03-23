import { useEffect, useState, useCallback } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/core/ui/command';

interface CannedResponse {
  id: string;
  shortcut: string;
  title: string;
  text: string;
}

const CANNED_RESPONSES: CannedResponse[] = [
  { id: '1', shortcut: '/greeting', title: 'Greeting', text: 'Hello {{customer.name}}! How can I help you today?' },
  { id: '2', shortcut: '/hold', title: 'Please hold', text: 'I need a moment to look into this. Please hold on.' },
  { id: '3', shortcut: '/transfer', title: 'Transfer notice', text: "I'm going to transfer you to a specialist who can help with this." },
  { id: '4', shortcut: '/thanks', title: 'Thank you', text: 'Thank you for contacting us! Is there anything else I can help with?' },
  { id: '5', shortcut: '/hours', title: 'Business hours', text: 'Our business hours are Monday to Friday, 8 AM to 6 PM.' },
  { id: '6', shortcut: '/escalate', title: 'Escalation', text: "I'm escalating this to our team lead who will follow up within 24 hours." },
];

interface CannedResponsesProps {
  open: boolean;
  onSelect: (text: string) => void;
  onClose: () => void;
  contactName: string;
}

function resolveTemplateVars(text: string, contactName: string): string {
  return text.replace(/\{\{customer\.name\}\}/g, contactName);
}

export function CannedResponses({ open, onSelect, onClose, contactName }: CannedResponsesProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const handleSelect = useCallback(
    (text: string) => {
      onSelect(resolveTemplateVars(text, contactName));
    },
    [onSelect, contactName],
  );

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1">
      <Command className="rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <CommandInput
          placeholder="Search quick reply..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup>
            {CANNED_RESPONSES.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.shortcut} ${r.title}`}
                onSelect={() => handleSelect(r.text)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{r.title}</span>
                  <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                    {r.text}
                  </span>
                </div>
                <CommandShortcut>{r.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
