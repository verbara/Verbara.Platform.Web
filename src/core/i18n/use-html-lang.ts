import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Syncs `<html lang>` with the current i18n language so screen readers
 * announce content in the correct language. WCAG 3.1.1 / 3.1.2.
 */
function useHtmlLang(): void {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
}

export { useHtmlLang };
