import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es, enUS, ptBR } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const localeMap: Record<string, Locale> = {
  'es-419': es,
  'en-US': enUS,
  'pt-BR': ptBR,
};

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value;
}

export function useFormatDate() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const locale = localeMap[language] ?? es;

  return {
    /** Default full datetime, locale-aware (replaces `.toLocaleString()`) */
    formatDate: (date: string | Date, fmt = 'PPp') => format(toDate(date), fmt, { locale }),
    /** Full date + time using browser Intl with the selected language */
    formatDateTime: (date: string | Date) =>
      new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(
        toDate(date),
      ),
    /** Date only, short form (replaces `.toLocaleDateString()`) */
    formatDateShort: (date: string | Date) =>
      new Intl.DateTimeFormat(language, { dateStyle: 'short' }).format(toDate(date)),
    /** Time only, short form (replaces `.toLocaleTimeString()`) */
    formatTimeShort: (date: string | Date) =>
      new Intl.DateTimeFormat(language, { timeStyle: 'short' }).format(toDate(date)),
    /** "5 minutes ago" / "hace 5 minutos" / "há 5 minutos" */
    formatRelative: (date: string | Date) =>
      formatDistanceToNow(toDate(date), { addSuffix: true, locale }),
  };
}

export function useFormatNumber() {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return {
    formatNumber: (n: number) => new Intl.NumberFormat(language).format(n),
    formatPercent: (n: number) =>
      new Intl.NumberFormat(language, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(n),
    /** Currency formatter using the selected language (replaces hardcoded 'en-US') */
    formatCurrency: (amount: number, currency: string) =>
      new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount),
    /** Duration in `MM:SS` format — locale-agnostic by design */
    formatDuration: (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    },
  };
}
