/**
 * The SIP domain a browser user agent registers under: the host name of the Asterisk WSS URL.
 * Shared by the agent softphone and the supervisor's listen user agent (design D1 of
 * `supervisor-silent-listen`), so both derive it the same way.
 */
export function deriveDomain(wssUrl: string): string {
  try {
    return new URL(wssUrl).hostname;
  } catch {
    return 'localhost';
  }
}
