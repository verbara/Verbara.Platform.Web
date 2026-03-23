import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RotateCcw, PhoneForwarded } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
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
import { useCampaignDispositions } from '@/core/api/hooks/use-campaigns';
import type { DispositionCode } from '@/core/api/hooks/use-campaigns';

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
  const conversation = useConversationStore((s) => s.conversations[conversationId]);

  const campaignId = conversation?.metadata?.campaignId
    ? Number(conversation.metadata.campaignId)
    : null;

  const { data: globalDispositions = [] } = useDispositions();
  const { data: campaignDispositions = [] } = useCampaignDispositions(campaignId ?? 0);

  const wrapUpMutation = useWrapUp();

  const [disposition, setDisposition] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackPhone, setCallbackPhone] = useState('');

  const selectedCampaignDispo: DispositionCode | undefined = campaignId
    ? campaignDispositions.find((d) => String(d.id) === disposition)
    : undefined;

  function handleSubmit() {
    if (!disposition) return;

    wrapUpMutation.mutate(
      {
        id: conversationId,
        dispositionId: campaignId ? undefined : disposition,
        campaignDispositionId: campaignId ? Number(disposition) : undefined,
        notes,
        callbackDate: callbackDate || undefined,
        callbackPhone: callbackPhone || undefined,
      },
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
    setCallbackDate('');
    setCallbackPhone('');
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
                {campaignId
                  ? (campaignDispositions as DispositionCode[]).map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="flex items-center gap-2">
                          {d.triggerRetry && (
                            <RotateCcw className="h-3 w-3 text-amber-500 shrink-0" />
                          )}
                          {d.triggerCallback && (
                            <PhoneForwarded className="h-3 w-3 text-blue-500 shrink-0" />
                          )}
                          {d.label}
                        </span>
                      </SelectItem>
                    ))
                  : (globalDispositions as Array<{ id: string; name: string }>).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* Callback scheduling — only for campaign dispositions with triggerCallback */}
          {selectedCampaignDispo?.triggerCallback && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('wrap_up.callbackDate', 'Callback date & time')}</Label>
                <Input
                  type="datetime-local"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('wrap_up.callbackPhone', 'Callback phone')}</Label>
                <Input
                  type="tel"
                  value={callbackPhone}
                  onChange={(e) => setCallbackPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
            </div>
          )}

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
