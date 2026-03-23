import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Maximize2 } from 'lucide-react';

interface KioskWrapperProps {
  children: React.ReactNode;
}

export function KioskWrapper({ children }: KioskWrapperProps) {
  const { t } = useTranslation('operations');
  const [searchParams, setSearchParams] = useSearchParams();
  const [isKiosk, setIsKiosk] = useState(searchParams.get('kiosk') === 'true');

  const exitKiosk = useCallback(() => {
    setIsKiosk(false);
    setSearchParams((prev) => {
      prev.delete('kiosk');
      return prev;
    });
  }, [setSearchParams]);

  const enterKiosk = useCallback(() => {
    setIsKiosk(true);
    setSearchParams((prev) => {
      prev.set('kiosk', 'true');
      return prev;
    });
  }, [setSearchParams]);

  useEffect(() => {
    if (!isKiosk) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        exitKiosk();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isKiosk, exitKiosk]);

  // Sync with URL params if they change externally
  useEffect(() => {
    setIsKiosk(searchParams.get('kiosk') === 'true');
  }, [searchParams]);

  if (isKiosk) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-slate-950 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">{t('wallboard.title')}</h1>
            <button
              type="button"
              onClick={exitKiosk}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            >
              {t('wallboard.kiosk_exit')}
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('wallboard.title')}</h1>
        <button
          type="button"
          onClick={enterKiosk}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Maximize2 className="h-4 w-4" />
          {t('wallboard.kiosk_enter')}
        </button>
      </div>
      {children}
    </div>
  );
}
