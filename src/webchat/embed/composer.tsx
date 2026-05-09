import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface ComposerProps {
  readonly disabled?: boolean;
  readonly onSend: (text: string) => void;
  readonly maxLength?: number;
  readonly shouldFocus?: boolean;
}

export function Composer({ disabled, onSend, maxLength = 4000, shouldFocus }: ComposerProps) {
  const { t } = useTranslation('webchat');
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (shouldFocus) ref.current?.focus();
  }, [shouldFocus]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t bg-white p-3">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder={t('composer.placeholder')}
        aria-label={t('composer.placeholder')}
        rows={1}
        className="flex-1 resize-none rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={{ maxHeight: '120px' }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label={t('composer.sendAriaLabel')}
        className="rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: 'var(--vw-primary, #0d9488)' }}
      >
        {t('composer.send')}
      </button>
    </div>
  );
}
