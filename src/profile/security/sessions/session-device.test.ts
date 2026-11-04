import { describe, it, expect } from 'vitest';
import { parseUserAgent } from './session-device';

/** The current row's `userAgent` in host fixture `own-sessions.v1.json`. */
const FIXTURE_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

describe('parseUserAgent', () => {
  it('parseUserAgent_ShouldReturnChromeOnLinux_WhenGivenTheFixtureUserAgent', () => {
    expect(parseUserAgent(FIXTURE_UA)).toEqual({ browser: 'Chrome', os: 'Linux' });
  });

  it('parseUserAgent_ShouldReturnNull_WhenTheUserAgentIsNull', () => {
    expect(parseUserAgent(null)).toBeNull();
  });

  it('parseUserAgent_ShouldReturnNull_WhenTheUserAgentIsEmpty', () => {
    expect(parseUserAgent('')).toBeNull();
  });

  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
      'Firefox',
      'Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
      'Safari',
      'macOS',
    ],
    ['curl/8.5.0', 'Browser', 'Unknown OS'],
  ] as const)('parseUserAgent_ShouldNameBrowserAndOs_WhenGiven %s', (ua, browser, os) => {
    expect(parseUserAgent(ua)).toEqual({ browser, os });
  });
});
