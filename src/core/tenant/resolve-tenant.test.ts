/**
 * The login page's tenant guess (spec `sign-in-refusal-feedback`, H16). The build-time default wins;
 * otherwise the first label of a host with three or more labels is taken as the tenant subdomain.
 * An IP address is never a tenant: its first "label" is an octet.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDefaultTenant } from './resolve-tenant';

function onHost(hostname: string, defaultTenant = '') {
  vi.stubEnv('VITE_DEFAULT_TENANT_ID', defaultTenant);
  vi.stubGlobal('location', { ...window.location, hostname });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('resolveDefaultTenant', () => {
  it('resolveDefaultTenant_ShouldReturnNull_WhenTheHostIsAnIPv4AddressAndNoDefaultIsBuiltIn', () => {
    onHost('10.0.0.5');

    expect(resolveDefaultTenant()).toBeNull();
  });

  it('resolveDefaultTenant_ShouldReturnNull_WhenTheHostIsABracketedIPv6Address', () => {
    onHost('[::ffff:10.0.0.5]');

    expect(resolveDefaultTenant()).toBeNull();
  });

  it('resolveDefaultTenant_ShouldReturnTheFirstLabel_WhenTheHostHasThreeOrMoreLabels', () => {
    onHost('console.example.com');

    expect(resolveDefaultTenant()).toBe('console');
  });

  it('resolveDefaultTenant_ShouldReturnTheBuiltInDefault_WhenOneIsSetWhateverTheHost', () => {
    onHost('10.0.0.5', 'acme');

    expect(resolveDefaultTenant()).toBe('acme');
  });

  it.each(['localhost', 'example.com', 'www.example.com', 'api.example.com'])(
    'resolveDefaultTenant_ShouldReturnNull_WhenTheHostCarriesNoTenantLabel %s',
    (hostname) => {
      onHost(hostname);

      expect(resolveDefaultTenant()).toBeNull();
    },
  );
});
