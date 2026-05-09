export function useFieldA11y(
  hasError: boolean,
  fieldId: string,
  options: { required?: boolean } = {},
): {
  fieldProps: { 'aria-required'?: 'true'; 'aria-invalid'?: 'true'; 'aria-describedby'?: string };
  errorId: string;
} {
  const errorId = `${fieldId}-error`;
  return {
    fieldProps: {
      ...(options.required ? { 'aria-required': 'true' as const } : {}),
      ...(hasError ? { 'aria-invalid': 'true' as const, 'aria-describedby': errorId } : {}),
    },
    errorId,
  };
}
