import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui/dialog';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useAgents } from '@/core/api/hooks/use-agents';
import { useVoiceTransfer } from '@/core/api/hooks/use-conversations';

interface VoiceTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tracked voice Conversation id (3B.1 correlation) the live call maps to. */
  conversationId: string;
}

type TargetKind = 'queue' | 'agent' | 'external';

/**
 * Blind-transfer picker for a LIVE voice call (3B.2c). Deliberately NOT the digital
 * {@link import('@/agent/conversation/transfer-dialog').TransferDialog}: a voice transfer is a
 * server-side AMI redirect of the customer's trunk leg (the browser softphone is single-session and
 * cannot REFER), so there is no warm/cold consult and no per-conversation note here — it is a one-shot
 * blind transfer to a queue or another agent. A compact centered modal (not the full-height Sheet) fits
 * the floating call card. On success the agent leg drops and the existing hangup→wrap-up flow takes
 * over. External targets are added in 3B.2d (they need the outbound route→trunk resolution).
 */
export function VoiceTransferDialog({
  open,
  onOpenChange,
  conversationId,
}: VoiceTransferDialogProps) {
  const { t } = useTranslation('agent');
  const { data: queues = [] } = useQueues();
  const { data: agents = [] } = useAgents();
  const voiceTransfer = useVoiceTransfer();

  const [kind, setKind] = useState<TargetKind>('queue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [externalNumber, setExternalNumber] = useState('');

  const term = search.trim().toLowerCase();
  const items: Array<{ id: string; name: string; state?: string }> =
    kind === 'queue'
      ? queues
          .filter((q) => q.name.toLowerCase().includes(term))
          .map((q) => ({ id: q.id, name: q.name }))
      : agents
          .filter((a) => a.displayName.toLowerCase().includes(term))
          .map((a) => ({ id: a.id, name: a.displayName, state: a.state }));

  function switchKind(next: TargetKind) {
    setKind(next);
    setSelectedId(null);
    setSearch('');
    setExternalNumber('');
  }

  function resetAndClose() {
    setKind('queue');
    setSelectedId(null);
    setSearch('');
    setExternalNumber('');
    onOpenChange(false);
  }

  // External targets a free-typed number; queue/agent target the picked id.
  const target = kind === 'external' ? externalNumber.trim() : selectedId;

  function handleSubmit() {
    if (!target) return;
    voiceTransfer.mutate(
      { id: conversationId, kind, target },
      {
        onSuccess: () => {
          toast.success(t('voice.transfer.success', 'Call transferred'));
          resetAndClose();
        },
        onError: () => toast.error(t('voice.transfer.failed', 'Could not transfer the call')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="voice-transfer-dialog">
        <DialogHeader>
          <DialogTitle>{t('voice.transfer.title', 'Transfer call')}</DialogTitle>
          <DialogDescription>
            {t('voice.transfer.description', 'Forward this call to a queue or another agent.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Target-kind toggle: Queue | Agent (3B.2c) | External number (3B.2d). */}
          <div className="flex gap-2">
            <Button
              data-testid="voice-transfer-to-queue"
              variant={kind === 'queue' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              aria-pressed={kind === 'queue'}
              onClick={() => switchKind('queue')}
            >
              {t('voice.transfer.to_queue', 'To a queue')}
            </Button>
            <Button
              data-testid="voice-transfer-to-agent"
              variant={kind === 'agent' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              aria-pressed={kind === 'agent'}
              onClick={() => switchKind('agent')}
            >
              {t('voice.transfer.to_agent', 'To an agent')}
            </Button>
            <Button
              data-testid="voice-transfer-to-external"
              variant={kind === 'external' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              aria-pressed={kind === 'external'}
              onClick={() => switchKind('external')}
            >
              {t('voice.transfer.to_external', 'External')}
            </Button>
          </div>

          {kind === 'external' ? (
            <Input
              data-testid="voice-transfer-external-number"
              value={externalNumber}
              onChange={(e) => setExternalNumber(e.target.value)}
              placeholder={t('voice.transfer.external_placeholder', '+1 555 010 0000')}
            />
          ) : (
            <>
              <div className="relative">
                <Search className="absolute top-2 left-2.5 size-4 text-slate-500" />
                <Input
                  data-testid="voice-transfer-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('voice.transfer.search', 'Search destination…')}
                  className="pl-8"
                />
              </div>

              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
                {items.length === 0 && (
                  <span className="px-2 py-3 text-center text-xs text-slate-500">
                    {t('voice.transfer.no_results', 'No results')}
                  </span>
                )}
                {items.map((item) => {
                  const isAgent = item.state !== undefined;
                  const isBusy = item.state === 'busy';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`voice-transfer-item-${item.id}`}
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('voice.transfer.cancel', 'Cancel')}
          </Button>
          <Button
            data-testid="voice-transfer-submit"
            onClick={handleSubmit}
            disabled={!target || voiceTransfer.isPending}
          >
            <ArrowRightLeft data-icon="inline-start" />
            {t('voice.transfer.submit', 'Transfer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
