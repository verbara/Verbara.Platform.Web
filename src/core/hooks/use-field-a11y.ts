interface FieldA11yOptions {
  readonly required?: boolean;
}

interface FieldA11yResult {
  readonly inputProps: {
    readonly 'aria-invalid'?: true;
    readonly 'aria-describedby'?: string;
    readonly 'aria-required'?: true;
  };
  readonly errorId: string;
}

function useFieldA11y(
  error: { message?: string } | undefined,
  baseId: string,
  options: FieldA11yOptions = {},
): FieldA11yResult {
  const errorId = `${baseId}-error`;
  const hasError = Boolean(error);
  return {
    inputProps: {
      'aria-invalid': hasError ? true : undefined,
      'aria-describedby': hasError ? errorId : undefined,
      'aria-required': options.required ? true : undefined,
    },
    errorId,
  };
}

export { useFieldA11y };
export type { FieldA11yOptions, FieldA11yResult };
