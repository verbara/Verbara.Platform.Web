import type { ReactNode } from 'react';

/**
 * The attribution line's words (Platform/ADR-0045, spec `console-verbara-attribution`). A code constant,
 * like the console's ` · Verbara` title suffix, rather than a translation: the widget loads its locale
 * bundle over HTTP at runtime, and "No runtime input removes the attribution" forbids a missing,
 * failed or edited bundle from rewording it (a raw `branding.poweredBy` key was shown with no bundle).
 * It is the same English words in every locale, as intended for a brand line.
 */
const POWERED_BY_VERBARA = 'Powered by Verbara';

/**
 * Frames every widget state with the "Powered by Verbara" line (Platform/ADR-0045). The line reads no config
 * field, no theme and no translation, so no init option or locale bundle can remove it. Layout: the root fills
 * `#root` (the iframe viewport), the content region takes what the footer leaves and scrolls a tall form or
 * survey inside it, and the `shrink-0` footer is never squeezed or pushed below the body's `overflow-hidden` clip.
 */
export function WidgetFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      <div className="shrink-0 border-t px-3 py-1 text-center text-[11px] text-gray-500">
        <span data-testid="webchat-powered-by">{POWERED_BY_VERBARA}</span>
      </div>
    </div>
  );
}
