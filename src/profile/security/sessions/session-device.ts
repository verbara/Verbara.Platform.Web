/** A session's device as read from its `userAgent` (design D-3): product names, never translated. */
export interface SessionDevice {
  readonly browser: string;
  readonly os: string;
}

/**
 * The browser and operating system a session's `userAgent` names, or `null` when it has none
 * (host fixture `own-sessions.v1.json`: `userAgent` is `string|null`). Callers render the words
 * around them (`device_label`, `device_unknown`) in the user's locale.
 */
export function parseUserAgent(ua: string | null): SessionDevice | null {
  if (!ua) return null;
  const browser = /Chrome/.test(ua)
    ? 'Chrome'
    : /Firefox/.test(ua)
      ? 'Firefox'
      : /Safari/.test(ua)
        ? 'Safari'
        : /Edge/.test(ua)
          ? 'Edge'
          : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS/.test(ua)
      ? 'macOS'
      : /Linux/.test(ua)
        ? 'Linux'
        : /Android/.test(ua)
          ? 'Android'
          : /iPhone|iPad/.test(ua)
            ? 'iOS'
            : 'Unknown OS';
  return { browser, os };
}
