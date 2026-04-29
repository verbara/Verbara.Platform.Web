import { useTranslation } from 'react-i18next';
import { Languages, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/ui/dropdown-menu';
import { Button } from '@/core/ui/button';
import type { SupportedLanguage } from './i18n';

interface LanguageOption {
  code: SupportedLanguage;
  labelKey: string;
  short: string;
}

const OPTIONS: LanguageOption[] = [
  { code: 'es-419', labelKey: 'language.es-419', short: 'ES' },
  { code: 'en-US', labelKey: 'language.en-US', short: 'EN' },
  { code: 'pt-BR', labelKey: 'language.pt-BR', short: 'PT' },
];

interface LanguageSwitcherProps {
  readonly variant?: 'inline' | 'icon';
}

export function LanguageSwitcher({ variant = 'inline' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;
  const currentOption =
    OPTIONS.find((o) => o.code === current) ??
    OPTIONS.find((o) => current.startsWith(o.code.split('-')[0] ?? '')) ??
    OPTIONS[0];

  if (!currentOption) return null;

  function changeLanguage(code: SupportedLanguage) {
    void i18n.changeLanguage(code);
  }

  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <button
              {...props}
              data-testid="language-switcher-icon"
              aria-label={t('language.label', 'Language')}
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
            />
          )}
        >
          <Languages className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="w-44">
          {OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.code}
              onClick={() => changeLanguage(opt.code)}
              data-testid={`language-option-${opt.code}`}
            >
              <span className="mr-2 inline-flex w-6 justify-center text-xs font-semibold text-muted-foreground">
                {opt.short}
              </span>
              <span className="flex-1">{t(opt.labelKey)}</span>
              {opt.code === currentOption.code && <Check className="ml-2 h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="sm"
            data-testid="language-switcher-inline"
            aria-label={t('language.label', 'Language')}
            className="gap-1.5"
          />
        )}
      >
        <Languages className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{currentOption.short}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-44">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.code}
            onClick={() => changeLanguage(opt.code)}
            data-testid={`language-option-${opt.code}`}
          >
            <span className="mr-2 inline-flex w-6 justify-center text-xs font-semibold text-muted-foreground">
              {opt.short}
            </span>
            <span className="flex-1">{t(opt.labelKey)}</span>
            {opt.code === currentOption.code && <Check className="ml-2 h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
