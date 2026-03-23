import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es, enUS, ptBR } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const localeMap: Record<string, Locale> = {
  'es-419': es,
  'en-US': enUS,
  'pt-BR': ptBR,
};

export function useFormatDate() {
  const { i18n } = useTranslation();
  const locale = localeMap[i18n.language] ?? es;

  return {
    formatDate: (date: string | Date, fmt = 'PPp') =>
      format(typeof date === 'string' ? parseISO(date) : date, fmt, { locale }),
    formatRelative: (date: string | Date) =>
      formatDistanceToNow(typeof date === 'string' ? parseISO(date) : date, {
        addSuffix: true,
        locale,
      }),
  };
}

export function useFormatNumber() {
  const { i18n } = useTranslation();

  return {
    formatNumber: (n: number) => new Intl.NumberFormat(i18n.language).format(n),
    formatPercent: (n: number) =>
      new Intl.NumberFormat(i18n.language, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(n),
    formatDuration: (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    },
  };
}
