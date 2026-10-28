import { useEffect } from 'react';
import { useBrandingStore } from '@/core/branding';

/**
 * The attribution every console tab title ends in (spec `console-verbara-attribution`). A module
 * constant the hook always appends: no argument, brand or setting drops it (design D5).
 */
const TITLE_SUFFIX = ' · Verbara';

/** The brand's display name for the title, or `null` when it is unset or is `Verbara` itself. */
function brandTitlePart(displayName: string | null | undefined): string | null {
  const name = displayName?.trim() ?? '';
  return name === '' || name.toLowerCase() === 'verbara' ? null : name;
}

/** Sets `page · <display name> · Verbara` while mounted, and restores the previous title on unmount. */
function useDocumentTitle(title: string): void {
  const brandName = brandTitlePart(useBrandingStore((s) => s.brand?.displayName));
  useEffect(() => {
    const previous = document.title;
    document.title =
      brandName === null ? `${title}${TITLE_SUFFIX}` : `${title} · ${brandName}${TITLE_SUFFIX}`;
    return () => {
      document.title = previous;
    };
  }, [title, brandName]);
}

export { useDocumentTitle };
