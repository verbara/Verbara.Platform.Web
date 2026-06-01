import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/core/ui/button';

/**
 * Reusable multi-step wizard chrome: a clickable step-indicator row + a
 * title/description header + Back/Next/Finish navigation buttons. Extracted
 * from the `campaign-wizard` pattern so any guided flow (trunk creation, future
 * onboarding flows, …) reuses the same layout and a11y affordances.
 *
 * The layout is presentation-only — it owns NO form state. The parent passes
 * the current step index, the step labels, the rendered step body (`children`),
 * and callbacks. This keeps it compatible with `react-hook-form`'s
 * `FormProvider` (the parent wraps `children` in the provider) and lets each
 * consumer decide its own per-step validation gating.
 */
export interface WizardStep {
  /** Stable key used for React keys + `data-testid` suffixes (locale-proof). */
  key: string;
  /** Already-translated short label rendered in the indicator. */
  label: string;
}

export interface WizardLayoutProps {
  /** Already-translated page title. */
  title: string;
  /** Optional already-translated page subtitle. */
  description?: string;
  steps: WizardStep[];
  /** Zero-based index of the active step. */
  currentStep: number;
  /** Jump directly to a step (clicking the indicator). */
  onStepClick: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  /** Already-translated label for the primary finish button. */
  finishLabel: string;
  /** Already-translated label for the Back button. */
  backLabel: string;
  /** Already-translated label for the Next button. */
  nextLabel: string;
  /** Disables all nav while a mutation is in flight. */
  isBusy?: boolean;
  /** Optional `data-testid` prefix, e.g. `trunk-wizard`. */
  testIdPrefix?: string;
  /** The active step's body. */
  children: ReactNode;
}

export function WizardLayout({
  title,
  description,
  steps,
  currentStep,
  onStepClick,
  onBack,
  onNext,
  onFinish,
  finishLabel,
  backLabel,
  nextLabel,
  isBusy = false,
  testIdPrefix = 'wizard',
  children,
}: WizardLayoutProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="space-y-6" data-testid={`${testIdPrefix}-layout`}>
      <div>
        <h1 className="font-heading text-2xl font-semibold" data-testid={`${testIdPrefix}-title`}>
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>

      {/* Step indicator */}
      <nav className="flex gap-1" aria-label={title} data-testid={`${testIdPrefix}-steps`}>
        {steps.map((s, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onStepClick(idx)}
              aria-current={isCurrent ? 'step' : undefined}
              data-testid={`${testIdPrefix}-step-${s.key}`}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors ${
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isDone
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* Step body */}
      <div data-testid={`${testIdPrefix}-body`}>{children}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          disabled={isFirst || isBusy}
          onClick={onBack}
          data-testid={`${testIdPrefix}-back`}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Button>

        {isLast ? (
          <Button disabled={isBusy} onClick={onFinish} data-testid={`${testIdPrefix}-finish`}>
            <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {finishLabel}
          </Button>
        ) : (
          <Button disabled={isBusy} onClick={onNext} data-testid={`${testIdPrefix}-next`}>
            {nextLabel}
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
