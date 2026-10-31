import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { normalizeStateToken } from '@/agent/inbox/agent-status-tokens';
import {
  useTransferTargetAgents,
  useTransferTargetQueues,
  type TransferTargetAgent,
} from '@/core/api/hooks/use-transfer-targets';
import { useTransferConversation } from '@/core/api/hooks/use-conversations';
import { useDebouncedValue } from '@/core/hooks/use-debounced-value';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function TransferDialog({ open, onOpenChange, conversationId }: TransferDialogProps) {
  const { t } = useTranslation('agent');
  const removeConversation = useConversationStore((s) => s.removeConversation);

  const transferMutation = useTransferConversation();

  const [targetType, setTargetType] = useState<'queue' | 'agent'>('queue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');

  // A cleared search needs no pause: it would otherwise read the other kind with the old term.
  const debouncedSearch = useDebouncedValue(search);
  const term = search === '' ? '' : debouncedSearch;
  const queuesQuery = useTransferTargetQueues(term, open && targetType === 'queue');
  const agentsQuery = useTransferTargetAgents(term, open && targetType === 'agent');

  const items: Array<{ id: string; name: string; state?: TransferTargetAgent['state'] }> =
    targetType === 'queue'
      ? (queuesQuery.data ?? []).map((q) => ({ id: q.id, name: q.name }))
      : (agentsQuery.data ?? []).map((a) => ({ id: a.id, name: a.displayName, state: a.state }));
  const isReading = targetType === 'queue' ? queuesQuery.isFetching : agentsQuery.isFetching;

  function handleSubmit() {
    if (!selectedId) return;

    const trimmedNote = note.trim();
    const payload = {
      id: conversationId,
      ...(targetType === 'queue' ? { targetQueueId: selectedId } : { targetAgentId: selectedId }),
      ...(trimmedNote === '' ? {} : { note: trimmedNote }),
    };

    transferMutation.mutate(payload, {
      onSuccess: () => {
        removeConversation(conversationId);
        toast.success(t('transfer.success'));
        resetAndClose();
      },
    });
  }

  function resetAndClose() {
    setTargetType('queue');
    setSelectedId(null);
    setSearch('');
    setNote('');
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" data-testid="transfer-dialog">
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
              data-testid="transfer-to-queue"
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
              data-testid="transfer-to-agent"
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
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
            <Input
              data-testid="transfer-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('transfer.search_placeholder')}
              className="pl-8"
            />
          </div>

          {/* Results list */}
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            {items.length === 0 && !isReading && (
              <span className="px-2 py-3 text-center text-xs text-slate-500">
                {t('transfer.no_results')}
              </span>
            )}
            {items.map((item) => {
              const isBusy = item.state === 'Busy';
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`transfer-item-${item.id}`}
                  data-agent-state={item.state}
                  disabled={isBusy}
                  onClick={() => setSelectedId(item.id)}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    selectedId === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  } ${isBusy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <span>{item.name}</span>
                  {item.state !== undefined && (
                    <span
                      className={`text-[10px] font-medium ${
                        item.state === 'Available' ? 'text-green-600' : 'text-amber-500'
                      }`}
                    >
                      {t(`agent_status.${normalizeStateToken(item.state)}`)}
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
              data-testid="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('transfer.note_placeholder')}
              rows={2}
              maxLength={1000}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('conversation.cancel')}
          </Button>
          <Button
            data-testid="transfer-submit"
            onClick={handleSubmit}
            disabled={!selectedId || transferMutation.isPending}
          >
            {t('conversation.transfer')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
