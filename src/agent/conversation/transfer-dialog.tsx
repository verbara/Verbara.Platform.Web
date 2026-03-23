import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { Switch } from '@/core/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { useConversationStore } from '@/agent/stores/conversation-store';

const MOCK_QUEUES = [
  { id: 'q1', name: 'Support' },
  { id: 'q2', name: 'Sales' },
  { id: 'q3', name: 'Billing' },
];

const MOCK_AGENTS = [
  { id: 'a1', name: 'John Smith', state: 'available' as const },
  { id: 'a2', name: 'Jane Doe', state: 'available' as const },
  { id: 'a3', name: 'Maria Garcia', state: 'busy' as const },
];

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function TransferDialog({
  open,
  onOpenChange,
  conversationId,
}: TransferDialogProps) {
  const { t } = useTranslation('agent');
  const removeConversation = useConversationStore((s) => s.removeConversation);

  const [targetType, setTargetType] = useState<'queue' | 'agent'>('queue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [warm, setWarm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const items =
    targetType === 'queue'
      ? MOCK_QUEUES.filter((q) =>
          q.name.toLowerCase().includes(search.toLowerCase()),
        )
      : MOCK_AGENTS.filter((a) =>
          a.name.toLowerCase().includes(search.toLowerCase()),
        );

  function handleSubmit() {
    if (!selectedId) return;
    setSubmitting(true);

    // Mock API call
    setTimeout(() => {
      removeConversation(conversationId);
      toast.success(t('transfer.success'));
      setSubmitting(false);
      resetAndClose();
    }, 400);
  }

  function resetAndClose() {
    setTargetType('queue');
    setSelectedId(null);
    setSearch('');
    setNote('');
    setWarm(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t('transfer.title')}</SheetTitle>
          <SheetDescription>{t('transfer.description')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {/* Target type radio */}
          <div className="flex gap-2">
            <Button
              variant={targetType === 'queue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTargetType('queue');
                setSelectedId(null);
                setSearch('');
              }}
            >
              {t('transfer.to_queue')}
            </Button>
            <Button
              variant={targetType === 'agent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTargetType('agent');
                setSelectedId(null);
                setSearch('');
              }}
            >
              {t('transfer.to_agent')}
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('transfer.search_placeholder')}
              className="pl-8"
            />
          </div>

          {/* Results list */}
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            {items.length === 0 && (
              <span className="px-2 py-3 text-center text-xs text-slate-400">
                {t('transfer.no_results')}
              </span>
            )}
            {items.map((item) => {
              const isAgent = 'state' in item;
              const isBusy = isAgent && item.state === 'busy';
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setSelectedId(item.id)}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    selectedId === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  } ${isBusy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <span>{item.name}</span>
                  {isAgent && (
                    <span
                      className={`text-[10px] font-medium ${
                        item.state === 'available'
                          ? 'text-green-600'
                          : 'text-amber-500'
                      }`}
                    >
                      {item.state}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-note">{t('transfer.note_label')}</Label>
            <Textarea
              id="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('transfer.note_placeholder')}
              rows={2}
            />
          </div>

          {/* Warm/Cold toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {warm ? t('transfer.warm') : t('transfer.cold')}
              </span>
              <span className="text-xs text-slate-400">
                {warm
                  ? t('transfer.warm_description')
                  : t('transfer.cold_description')}
              </span>
            </div>
            <Switch checked={warm} onCheckedChange={setWarm} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('conversation.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedId || submitting}>
            {t('conversation.transfer')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
