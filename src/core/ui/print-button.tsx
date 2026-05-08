import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import type { RefObject, ReactNode } from 'react';

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

interface PrintButtonProps {
  readonly contentRef: RefObject<HTMLElement | null>;
  readonly documentTitle?: string;
  readonly onBeforePrint?: () => void | Promise<void>;
  readonly onAfterPrint?: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children?: ReactNode;
}

export function PrintButton({
  contentRef,
  documentTitle,
  onBeforePrint,
  onAfterPrint,
  variant = 'outline',
  size,
  children,
}: PrintButtonProps) {
  const { t } = useTranslation('common');
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    onBeforePrint: onBeforePrint
      ? async () => {
          await onBeforePrint();
        }
      : undefined,
    onAfterPrint,
  });

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => handlePrint()}
      aria-label={t('print.buttonAriaLabel')}
      data-print="hide"
    >
      <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {children ?? t('print.button')}
    </Button>
  );
}
