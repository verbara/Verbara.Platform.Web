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
            the conversation-store cleanup on success. */}
        <DynamicTypificationForm
          conversationId={conversationId}
          enabled={open}
          onCompleted={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
