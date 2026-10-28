import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Frames every widget state with the "Powered by Verbara" line (Platform/ADR-0045). The line reads no config
 * field and no theme, so no init option can remove it. Layout: the root fills `#root` (the iframe viewport), the
 * content region takes what the footer leaves and scrolls a tall form or survey inside it, and the `shrink-0`
 * footer is never squeezed or pushed below the body's `overflow-hidden` clip.
 */
export function WidgetFrame({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation('webchat');
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      <div className="shrink-0 border-t px-3 py-1 text-center text-[11px] text-gray-500">
        <span data-testid="webchat-powered-by">{t('branding.poweredBy')}</span>
      </div>
    </div>
  );
}
