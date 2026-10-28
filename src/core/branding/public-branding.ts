import type { components } from '@/core/api/generated/openapi';

/**
 * The 200 body of `GET /api/v1/branding/{tenantId}` and `GET /api/v1/branding/by-subdomain/{subdomain}`,
 * as Platform's OpenAPI document declares it (design D6 of `licensee-branding-in-the-console`).
 *
 * The schema lists all eight fields as required, but the Platform's JSON writer omits a field with no
 * value (`WhenWritingNull`), so a real body may lack any of them and an all-blank brand answers `{}`.
 * `parsePublicBranding` therefore reads a missing key exactly like `null`, and only its output, never
 * a raw response body, has this type.
 */
export type PublicBrandingDto = components['schemas']['PublicBrandingDto'];

/**
 * A hex colour of 3, 4, 6 or 8 digits. Narrower than the widget's `ALLOWED_COLOR`, because the value
 * is placed inside `color-mix()` and fed to the contrast computation (design D5).
 */
const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The value as a non-blank string, or `null` (the Platform already treats a blank field as unset). */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** An image address kept only when it is `https:` or on the console's own origin (design D5). */
function safeImageUrl(value: unknown): string | null {
  const raw = text(value);
  if (raw === null) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === 'https:' || url.origin === window.location.origin ? raw : null;
  } catch {
    return null;
  }
}

function safeColor(value: unknown): string | null {
  const raw = text(value);
  return raw !== null && HEX_COLOR.test(raw) ? raw : null;
}

/**
 * Parse a branding body (design D2): only string fields are kept, a blank one is unset, and the
 * safety rules of design D5 drop an unsafe logo, favicon or colour. The display name is kept as is;
 * it is only ever rendered as a React text node. A body that is not an object is `null`, a failure.
 */
export function parsePublicBranding(json: unknown): PublicBrandingDto | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const body = json as Record<string, unknown>;
  return {
    displayName: text(body.displayName),
    logoUrl: safeImageUrl(body.logoUrl),
    faviconUrl: safeImageUrl(body.faviconUrl),
    primaryColor: safeColor(body.primaryColor),
    secondaryColor: safeColor(body.secondaryColor),
    accentColor: safeColor(body.accentColor),
    locale: text(body.locale),
    timezone: text(body.timezone),
  };
}
