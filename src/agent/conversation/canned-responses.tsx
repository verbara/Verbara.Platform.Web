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
import { useSearchCannedResponses } from '@/core/api/hooks/use-canned-responses';

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
  const { data: responses, isLoading } = useSearchCannedResponses(search);

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const handleSelect = useCallback(
    (body: string) => {
      onSelect(resolveTemplateVars(body, contactName));
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
      <Command
        className="rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search quick reply..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {search.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              Start typing to search canned responses
            </p>
          ) : isLoading ? (
            <p className="py-4 text-center text-xs text-slate-400">Loading...</p>
          ) : (
            <>
              <CommandEmpty>No results</CommandEmpty>
              {responses && responses.length > 0 && (
                <CommandGroup>
                  {responses.map((r) => (
                    <CommandItem
                      key={r.responseId}
                      value={`${r.shortcut} ${r.title}`}
                      onSelect={() => handleSelect(r.body)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{r.title}</span>
                        <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                          {r.body}
                        </span>
                      </div>
                      <CommandShortcut>{r.shortcut}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
