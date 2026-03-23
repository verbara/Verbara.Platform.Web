import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Textarea } from '@/core/ui/textarea';
import { useConversationStore } from '@/agent/stores/conversation-store';

interface Note {
  id: string;
  text: string;
  timestamp: string;
}

type NotesMap = Record<string, Note[]>;

export function AgentNotes() {
  const { t } = useTranslation(['agent']);
  const selectedId = useConversationStore((s) => s.selectedId);

  const [allNotes, setAllNotes] = useState<NotesMap>({});
  const [draft, setDraft] = useState('');

  const notes = selectedId ? allNotes[selectedId] ?? [] : [];

  const handleSave = useCallback(() => {
    if (!selectedId || !draft.trim()) return;

    const note: Note = {
      id: `note-${Date.now()}`,
      text: draft.trim(),
      timestamp: new Date().toISOString(),
    };

    setAllNotes((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] ?? []), note],
    }));
    setDraft('');
  }, [selectedId, draft]);

  const handleDelete = useCallback(
    (noteId: string) => {
      if (!selectedId) return;
      setAllNotes((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).filter((n) => n.id !== noteId),
      }));
    },
    [selectedId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  if (!selectedId) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-slate-400">
        {t('agent:context.no_contact')}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Add note */}
      <div className="space-y-2 border-b border-slate-100 p-4 dark:border-slate-700">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('agent:context.notes_placeholder')}
          className="min-h-20 text-sm"
        />
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={!draft.trim()}
          className="w-full"
        >
          {t('agent:context.save_note')}
        </Button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex items-center justify-center p-6 text-sm text-slate-400">
            {t('agent:context.no_notes')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {[...notes].reverse().map((note) => (
              <div key={note.id} className="group px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm text-slate-700 whitespace-pre-wrap dark:text-slate-200">
                    {note.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    className="shrink-0 rounded p-1 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100 dark:text-slate-500 dark:hover:text-red-400"
                    title={t('agent:context.delete_note')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {format(new Date(note.timestamp), 'HH:mm')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
