import { describe, expect, it } from 'vitest';
import { roleDefaultRoute } from './role-default-route';

describe('roleDefaultRoute', () => {
  it.each([
    ['admin', '/admin'],
    ['supervisor', '/operations'],
    ['agent', '/agent'],
  ])('ShouldLand %s on %s', (role, route) => {
    expect(roleDefaultRoute(role)).toBe(route);
  });

  it.each(['api', 'auditor', 'Admin', 'constructor', ''])(
    'ShouldFallBackToAgent_WhenTheRoleIs %j',
    (role) => {
      expect(roleDefaultRoute(role)).toBe('/agent');
    },
  );

  it.each([undefined, null])('ShouldFallBackToAgent_WhenThereIsNoRole (%s)', (role) => {
    expect(roleDefaultRoute(role)).toBe('/agent');
  });
});
