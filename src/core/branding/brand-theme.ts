import type { PublicBrandingDto } from './public-branding';

/**
 * The theme layer (design D5 of `licensee-branding-in-the-console`): the brand's favicon on
 * `link[rel="icon"]` and its primary colour as the Tailwind 4 brand tokens of `index.css`, set inline
 * on the document root. `.dark` does not redefine these tokens, so one value serves both themes. The
 * shadcn `--primary` token is left alone (deferred, tasks.md 5.2). Every call is a no-op without a
 * `document`.
 */

/** The five properties a primary colour sets, and a reset removes. */
export const BRAND_CSS_PROPERTIES = [
  '--color-brand',
  '--color-brand-light',
  '--color-brand-dark',
  '--color-brand-foreground',
  '--color-rail-active-border',
] as const;

const LIGHT_FOREGROUND = '#ffffff';
const DARK_FOREGROUND = '#0f172a';

/** The favicon as the document had it before the first brand was applied. */
let originalIcon: { readonly href: string | null; readonly type: string | null } | null = null;

function iconLink(): HTMLLinkElement | null {
  return typeof document === 'undefined'
    ? null
    : document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
}

/** WCAG relative luminance of a `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` colour; alpha is ignored. */
function luminance(hex: string): number {
  const digits = hex.slice(1);
  const full =
    digits.length <= 4
      ? digits
          .slice(0, 3)
          .split('')
          .map((d) => d + d)
          .join('')
      : digits.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `#ffffff` or `#0f172a`, whichever has the higher WCAG contrast against the primary. */
export function brandForeground(primary: string): string {
  const l = luminance(primary);
  return contrast(l, luminance(LIGHT_FOREGROUND)) >= contrast(l, luminance(DARK_FOREGROUND))
    ? LIGHT_FOREGROUND
    : DARK_FOREGROUND;
}

/** Restore the original favicon and remove the five brand properties. */
export function resetBrandTheme(): void {
  if (typeof document === 'undefined') return;
  const link = iconLink();
  if (link && originalIcon) {
    if (originalIcon.href === null) link.removeAttribute('href');
    else link.setAttribute('href', originalIcon.href);
    if (originalIcon.type === null) link.removeAttribute('type');
    else link.setAttribute('type', originalIcon.type);
  }
  originalIcon = null;
  const style = document.documentElement.style;
  for (const property of BRAND_CSS_PROPERTIES) style.removeProperty(property);
}

/**
 * Paint a brand: the fields it sets replace the defaults, the others keep them. The values were
 * already checked by `parsePublicBranding` (design D5 safety rules).
 */
export function applyBrandTheme(brand: PublicBrandingDto | null): void {
  if (typeof document === 'undefined') return;
  resetBrandTheme();
  if (!brand) return;

  const link = iconLink();
  if (link && brand.faviconUrl) {
    originalIcon = { href: link.getAttribute('href'), type: link.getAttribute('type') };
    link.setAttribute('href', brand.faviconUrl);
    link.removeAttribute('type');
  }

  const primary = brand.primaryColor;
  if (primary) {
    const style = document.documentElement.style;
    style.setProperty('--color-brand', primary);
    style.setProperty('--color-brand-light', `color-mix(in oklab, ${primary} 80%, white)`);
    style.setProperty('--color-brand-dark', `color-mix(in oklab, ${primary} 80%, black)`);
    style.setProperty('--color-brand-foreground', brandForeground(primary));
    style.setProperty('--color-rail-active-border', primary);
  }
}
