/**
 * The login page's tenant guess (spec `sign-in-refusal-feedback`, H16). The build-time default wins;
 * otherwise the first label of a host with three or more labels is taken as the tenant subdomain.
 * An IP address is never a tenant: its first "label" is an octet.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostTenantLabel, resolveDefaultTenant } from './resolve-tenant';

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

  /**
   * Contract pin (spec `console-host-tenant-guess`, "The build-time default wins over any host"):
   * passes before the fix too. It covers an IP host and a host whose first label would otherwise be
   * taken as a tenant.
   */
  it('resolveDefaultTenant_ShouldReturnTheBuiltInDefault_WhenOneIsSetWhateverTheHost', () => {
    onHost('10.0.0.5', 'acme');

    expect(resolveDefaultTenant()).toBe('acme');

    onHost('other.platform.example', 'acme');

    expect(resolveDefaultTenant()).toBe('acme');
  });

  it.each(['localhost', 'example.com', 'www.example.com', 'api.example.com'])(
    'resolveDefaultTenant_ShouldReturnNull_WhenTheHostCarriesNoTenantLabel %s',
    (hostname) => {
      onHost(hostname);

      expect(resolveDefaultTenant()).toBeNull();
    },
  );

  // Regression cases for spec `console-host-tenant-guess` (Platform/ADR-0038 §1 row 3 mirrored on
  // the console). A browser canonicalises IPv4 and lowercases the host, but keeps the trailing dot
  // of a non-IP host, so (a) is the browser-reachable defect; (b) and (c) pin parity with the server
  // against a caller that does not read `location.hostname`.

  /** (a) "A trailing-dot two-label host is the same host": `acme-corp.lan.` is two labels, not three. */
  it('resolveDefaultTenant_ShouldReturnNull_WhenATwoLabelHostEndsInATrailingDot', () => {
    onHost('acme-corp.lan.');

    expect(resolveDefaultTenant()).toBeNull();
  });

  /** (b) "An uppercase reserved label pre-fills nothing": the reserved labels match in any case. */
  it.each(['WWW.example.com', 'API.example.com', 'Localhost.example.com'])(
    'resolveDefaultTenant_ShouldReturnNull_WhenTheReservedFirstLabelIsNotLowercase %s',
    (hostname) => {
      onHost(hostname);

      expect(resolveDefaultTenant()).toBeNull();
    },
  );

  /** (c) "A trailing-dot IPv4 host pre-fills nothing": the trailing dot does not hide the IP. */
  it('resolveDefaultTenant_ShouldReturnNull_WhenTheHostIsAnIPv4AddressWithATrailingDot', () => {
    onHost('127.0.0.1.');

    expect(resolveDefaultTenant()).toBeNull();
  });

  /**
   * (d) "A real tenant subdomain still pre-fills its tenant", with the trailing dot. Passes before
   * the fix too: it guards the normalisation against trimming more than the one trailing dot.
   */
  it('resolveDefaultTenant_ShouldReturnTheFirstLabel_WhenAThreeLabelHostEndsInATrailingDot', () => {
    onHost('acme.platform.example.');

    expect(resolveDefaultTenant()).toBe('acme');
  });
});

/**
 * The host label alone (design D1 of `licensee-branding-in-the-console`): the same normalised first
 * label `resolveDefaultTenant` falls back to, without the build-time default, so the sign-in page can
 * look the host's brand up by subdomain even on a build that pre-fills a tenant.
 */
describe('hostTenantLabel', () => {
  it.each([
    '10.0.0.5',
    '[::ffff:10.0.0.5]',
    '127.0.0.1.',
    'localhost',
    'example.com',
    'www.example.com',
    'api.example.com',
    'WWW.example.com',
    'API.example.com',
    'Localhost.example.com',
    'acme-corp.lan.',
  ])('hostTenantLabel_ShouldReturnNull_WhenTheHostCarriesNoTenantLabel %s', (hostname) => {
    onHost(hostname);

    expect(hostTenantLabel()).toBeNull();
  });

  it.each(['acme.platform.example', 'acme.platform.example.', 'ACME.Platform.Example'])(
    'hostTenantLabel_ShouldReturnTheNormalisedFirstLabel_WhenTheHostHasThreeOrMoreLabels %s',
    (hostname) => {
      onHost(hostname);

      expect(hostTenantLabel()).toBe('acme');
    },
  );

  it('hostTenantLabel_ShouldIgnoreTheBuiltInDefault_WhenOneIsSet', () => {
    onHost('acme.platform.example', 'globex');

    expect(hostTenantLabel()).toBe('acme');
    expect(resolveDefaultTenant()).toBe('globex');

    onHost('10.0.0.5', 'globex');

    expect(hostTenantLabel()).toBeNull();
  });
});
