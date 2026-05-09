import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';

interface PhoneInputProps extends Omit<
  ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange'
> {
  readonly value: string;
  readonly onChange: (e164: string) => void;
  readonly defaultCountry?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'US',
  placeholder,
  'aria-label': ariaLabel,
  ...rest
}: PhoneInputProps) {
  const { t } = useTranslation('common');
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import('@/core/i18n/phone-engine').then(() => {
      if (!cancelled) setEngineReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Input
      {...rest}
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t('phone.placeholder')}
      aria-label={ariaLabel ?? t('phone.ariaLabel')}
      data-engine-ready={engineReady ? 'true' : 'false'}
      data-default-country={defaultCountry}
    />
  );
}
