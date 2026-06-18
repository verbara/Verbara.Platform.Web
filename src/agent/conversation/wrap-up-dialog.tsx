import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/core/ui/sheet';
import { DynamicTypificationForm } from './dynamic-typification-form';

interface WrapUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function WrapUpDialog({ open, onOpenChange, conversationId }: WrapUpDialogProps) {
  const { t } = useTranslation('agent');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t('wrap_up.title')}</SheetTitle>
          <SheetDescription>{t('wrap_up.description')}</SheetDescription>
        </SheetHeader>

        {/* Schema-driven wrap-up body. The form fetches the bound typification
            schema for this conversation and renders the cascading outcome
            selectors + conditional fields; it owns submit (POST /typify) and
            the conversation-store cleanup on success.

            key per conversation: the form holds a conversation-scoped AI-suggestion
            mutation (useTypificationSuggestion — a useMutation whose .data persists
            until the next request resolves) plus wrap-up state. The dialog reuses
            ONE form instance across conversation switches, so without a key
            conversation-A's band='AutoFill' suggestion could auto-fill (and tag
            AI-accepted) conversation-B's freshly-loaded form. Remounting on switch
            gives each conversation a fresh suggestion mutation + clean state
            (mirrors the ReplyComposer key={conversationId} precedent in
            conversation-panel.tsx). Keyed by conversationId (NOT open) so
            closing+reopening the SAME conversation preserves in-progress state. */}
        <DynamicTypificationForm
          key={conversationId}
          conversationId={conversationId}
          enabled={open}
          onCompleted={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
