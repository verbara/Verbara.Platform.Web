const ROLE_DEFAULT_ROUTES = new Map<string, string>([
  ['admin', '/admin'],
  ['supervisor', '/operations'],
  ['agent', '/agent'],
]);

/** Where a user lands by role: `TokenUserDto.role`, in lower case. Any other role goes to `/agent`. */
export function roleDefaultRoute(role: string | null | undefined): string {
  return ROLE_DEFAULT_ROUTES.get(role ?? '') ?? '/agent';
}
