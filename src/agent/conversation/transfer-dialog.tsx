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
import { useQueues } from '@/core/api/hooks/use-queues';
import { useAgents } from '@/core/api/hooks/use-agents';
import { useTransferConversation } from '@/core/api/hooks/use-conversations';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function TransferDialog({ open, onOpenChange, conversationId }: TransferDialogProps) {
  const { t } = useTranslation('agent');
  const removeConversation = useConversationStore((s) => s.removeConversation);

  const { data: queues = [] } = useQueues();
  const { data: agents = [] } = useAgents();
  const transferMutation = useTransferConversation();

  const [targetType, setTargetType] = useState<'queue' | 'agent'>('queue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [warm, setWarm] = useState(false);

  const items =
    targetType === 'queue'
      ? queues
          .filter((q) => q.name.toLowerCase().includes(search.toLowerCase()))
          .map((q) => ({ id: q.id, name: q.name }))
      : agents
          .filter((a) => a.displayName.toLowerCase().includes(search.toLowerCase()))
          .map((a) => ({ id: a.id, name: a.displayName, state: a.state }));

  function handleSubmit() {
    if (!selectedId) return;

    const payload =
      targetType === 'queue'
        ? { id: conversationId, targetQueueId: selectedId }
        : { id: conversationId, targetAgentId: selectedId };

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
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
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
              <span className="px-2 py-3 text-center text-xs text-slate-500">
                {t('transfer.no_results')}
              </span>
            )}
            {items.map((item) => {
              const isAgent = 'state' in item;
              // `Agent.state` is now the generated `AgentState` enum after the
              // openapi-response adoption; widen to string for this comparison to
              // preserve the prior `state: string` matching behavior verbatim.
              const isBusy = isAgent && (item.state as string) === 'busy';
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
                        item.state === 'available' ? 'text-green-600' : 'text-amber-500'
                      }`}
                    >
                      {String(item.state)}
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
              <span className="text-xs text-slate-500">
                {warm ? t('transfer.warm_description') : t('transfer.cold_description')}
              </span>
            </div>
            <Switch checked={warm} onCheckedChange={setWarm} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('conversation.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedId || transferMutation.isPending}>
            {t('conversation.transfer')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
