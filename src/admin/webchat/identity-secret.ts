/**
 * A new WebChat identity secret: 32 random bytes as base64url with no padding, 43 characters. The browser generates
 * it and Platform never returns it, so the admin section is the only place it is ever shown.
 */
export function generateIdentitySecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
