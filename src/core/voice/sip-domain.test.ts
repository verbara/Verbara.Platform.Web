import { describe, it, expect } from 'vitest';
import { deriveDomain } from './sip-domain';

/** The SIP domain both user agents register under (design D1): the WSS URL's host name. */
describe('deriveDomain', () => {
  it('DeriveDomain_ShouldReturnTheHostName_WhenTheWssUrlHasAPortAndPath', () => {
    expect(deriveDomain('wss://pbx.example:8089/ws')).toBe('pbx.example');
  });

  it('DeriveDomain_ShouldReturnLocalhost_WhenTheUrlIsInvalid', () => {
    expect(deriveDomain('not a url')).toBe('localhost');
  });
});
