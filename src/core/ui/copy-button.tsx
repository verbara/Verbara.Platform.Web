import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/core/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/ui/tooltip';

export interface CopyButtonProps {
  readonly value: string;
  readonly label?: string;
  readonly successLabel?: string;
  readonly variant?: 'ghost' | 'outline' | 'default';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly iconOnly?: boolean;
}

// Maps the primitive's size token to the underlying Button's size token.
// The Button component exposes { default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg }.
function mapSize(size: NonNullable<CopyButtonProps['size']>, iconOnly: boolean): 'sm' | 'default' | 'lg' | 'icon-sm' | 'icon' | 'icon-lg' {
  if (iconOnly) {
    if (size === 'sm') return 'icon-sm';
    if (size === 'lg') return 'icon-lg';
    return 'icon';
  }
  if (size === 'sm') return 'sm';
  if (size === 'lg') return 'lg';
  return 'default';
}

export function CopyButton({
  value,
  label,
  successLabel,
  variant = 'ghost',
  size = 'sm',
  iconOnly = false,
}: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolvedLabel = label ?? t('copy', 'Copy');
  const resolvedSuccessLabel = successLabel ?? t('copied', 'Copied');

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t('copied', 'Copied'));
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000);
    } catch {
      // Clipboard may be blocked (insecure context, permissions). Fail silently.
    }
  }, [value, t]);

  const Icon = copied ? Check : Copy;
  const buttonSize = mapSize(size, iconOnly);
  const activeLabel = copied ? resolvedSuccessLabel : resolvedLabel;

  if (iconOnly) {
    return (
      <TooltipProvider delay={200}>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                {...props}
                type="button"
                variant={variant}
                size={buttonSize}
                aria-label={resolvedLabel}
                onClick={handleCopy}
              >
                <Icon aria-hidden="true" />
                <span className="sr-only">{activeLabel}</span>
              </Button>
            )}
          />
          <TooltipContent>{resolvedLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={buttonSize}
      onClick={handleCopy}
    >
      <Icon aria-hidden="true" />
      <span>{activeLabel}</span>
    </Button>
  );
}
