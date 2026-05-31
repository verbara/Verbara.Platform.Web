/**
 * Generates a strong, Asterisk-safe (alphanumeric only) SIP password. 16 chars
 * from a 55-symbol ambiguity-reduced alphabet ≈ 92 bits of entropy. Used by the
 * admin agent form to provision an in-browser softphone (Phase 3A).
 */
export function generateSipPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
