import { toast } from 'sonner';
import type { TFunction } from 'i18next';
import { describeApiError, type ApiErrorEntry, type ApiErrorMap } from './api-error';

/**
 * Shows a refused request as a localized error toast (design D1, ADR-0013). The text comes from
 * the map's i18n key in the active locale; the element carries `data-error-code` with the entry's
 * code, identical in every locale, so tests and E2E specs assert the outcome without reading text.
 * The server's own text is never shown.
 *
 * `values` are interpolated into the translation (for example the refused fields' labels).
 * Returns the entry it showed, so a caller can also branch on the code.
 */
export function toastApiError<A extends string>(
  err: unknown,
  map: ApiErrorMap<A>,
  t: TFunction,
  options: { action?: A; values?: Record<string, unknown> } = {},
): ApiErrorEntry {
  const entry = describeApiError(err, map, options.action);
  const text = String(t(entry.key, options.values ?? {}));
  toast.error(<span data-error-code={entry.code}>{text}</span>);
  return entry;
}
