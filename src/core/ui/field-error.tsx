import { cn } from '@/lib/utils';

interface FieldErrorProps {
  readonly id: string;
  readonly message?: string;
  readonly className?: string;
  /** Rendered as `data-testid`, a locale-proof selector for the message. */
  readonly testId?: string;
}

function FieldError({ id, message, className, testId }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      data-testid={testId}
      className={cn('text-xs text-destructive', className)}
    >
      {message}
    </p>
  );
}

export { FieldError };
export type { FieldErrorProps };
