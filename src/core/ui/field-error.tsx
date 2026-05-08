import { cn } from '@/lib/utils';

interface FieldErrorProps {
  readonly id: string;
  readonly message?: string;
  readonly className?: string;
}

function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn('text-xs text-destructive', className)}>
      {message}
    </p>
  );
}

export { FieldError };
export type { FieldErrorProps };
