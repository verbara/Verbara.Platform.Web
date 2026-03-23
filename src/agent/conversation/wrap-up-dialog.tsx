import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useDispositions } from '@/core/api/hooks/use-dispositions';
import { useWrapUp } from '@/core/api/hooks/use-conversations';

interface WrapUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function WrapUpDialog({
  open,
  onOpenChange,
  conversationId,
}: WrapUpDialogProps) {
  const { t } = useTranslation('agent');
  const removeConversation = useConversationStore((s) => s.removeConversation);

  const { data: dispositions = [] } = useDispositions();
  const wrapUpMutation = useWrapUp();

  const [disposition, setDisposition] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  function handleSubmit() {
    if (!disposition) return;

    wrapUpMutation.mutate(
      { id: conversationId, dispositionId: disposition, notes },
      {
        onSuccess: () => {
          removeConversation(conversationId);
          toast.success(t('wrap_up.success'));
          resetAndClose();
        },
      },
    );
  }

  function resetAndClose() {
    setDisposition(null);
    setNotes('');
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t('wrap_up.title')}</SheetTitle>
          <SheetDescription>{t('wrap_up.description')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {/* Disposition code */}
          <div className="flex flex-col gap-1.5">
            <Label>{t('wrap_up.disposition')}</Label>
            <Select
              value={disposition ?? undefined}
              onValueChange={(v) => setDisposition(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('wrap_up.select_disposition')} />
              </SelectTrigger>
              <SelectContent>
                {dispositions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wrapup-notes">{t('wrap_up.notes')}</Label>
            <Textarea
              id="wrapup-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('wrap_up.notes_placeholder')}
              rows={4}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t('conversation.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!disposition || wrapUpMutation.isPending}>
            {t('wrap_up.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
