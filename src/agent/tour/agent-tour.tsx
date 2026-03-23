import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/core/stores/ui-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { TOUR_STEPS } from './tour-steps';

export function AgentTour() {
  const { t } = useTranslation('agent');
  const tourDismissed = useUiStore((s) => s.tourDismissed);
  const setTourDismissed = useUiStore((s) => s.setTourDismissed);
  const role = useAuthStore((s) => s.user?.role);

  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (tourDismissed || role !== 'agent') return;

    const tourStep = TOUR_STEPS[step];
    if (!tourStep) return;

    const handle = requestAnimationFrame(() => {
      const el = document.querySelector(tourStep.targetSelector);
      if (el) {
        setRect(el.getBoundingClientRect());
      }
    });

    return () => cancelAnimationFrame(handle);
  }, [step, tourDismissed, role]);

  const dismiss = useCallback(() => setTourDismissed(true), [setTourDismissed]);

  const advance = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  if (tourDismissed || role !== 'agent') return null;
  if (!rect) return null;

  const current = TOUR_STEPS[step];
  if (!current) return null;
  const isLast = step === TOUR_STEPS.length - 1;

  const tooltipStyle: React.CSSProperties = (() => {
    const gap = 12;
    switch (current.position) {
      case 'right':
        return {
          position: 'absolute',
          top: rect.top,
          left: rect.right + gap,
        };
      case 'left':
        return {
          position: 'absolute',
          top: rect.top,
          right: window.innerWidth - rect.left + gap,
        };
      case 'bottom':
        return {
          position: 'absolute',
          top: rect.bottom + gap,
          left: rect.left,
        };
    }
  })();

  return (
    <div className="fixed inset-0 z-50">
      {/* Spotlight cutout */}
      <div
        className="pointer-events-none absolute transition-all duration-300 ease-in-out"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          borderRadius: '8px',
        }}
      />

      {/* Tooltip card */}
      <div
        className="w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        style={tooltipStyle}
      >
        <p className="mb-1 text-xs text-slate-400">
          {step + 1} / {TOUR_STEPS.length}
        </p>
        <p className="mb-1 font-bold text-slate-900 dark:text-white">
          {t(current.titleKey)}
        </p>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {t(current.descriptionKey)}
        </p>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {t('tour.skipTour')}
          </button>
          <button
            type="button"
            onClick={advance}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {isLast ? t('tour.gotIt') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
