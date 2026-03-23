import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  onClick?: () => void;
}

export function ExportButton({ onClick }: ExportButtonProps) {
  const { t } = useTranslation('analytics');

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
    >
      <Download className="h-3.5 w-3.5" />
      {t('export.csv')}
    </button>
  );
}
