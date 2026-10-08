import type { components } from '@/core/api/generated/openapi';

/**
 * A user's role as Platform's `UserRole` enum names it (`Agent` | `Supervisor` | `Admin` | `Api`).
 * Writes send these names; a rename on the Platform side fails `npm run build` here instead of
 * shipping a 400 (design D7).
 */
export type UserRole = components['schemas']['UserRole'];

/**
 * One entry per `UserRole` member, typed as a `Record` so a role added to the contract fails the
 * build until it gets a label and a rank. `rank` orders the roles the way Platform does when it
 * decides that a change lowers a role and ends the user's sessions: Admin above Supervisor above
 * Agent above Api. Insertion order is the order the form offers.
 */
const ROLE_META: Record<UserRole, { labelKey: string; rank: number }> = {
  Admin: { labelKey: 'admin:users.role_names.admin', rank: 3 },
  Supervisor: { labelKey: 'admin:users.role_names.supervisor', rank: 2 },
  Agent: { labelKey: 'admin:users.role_names.agent', rank: 1 },
  Api: { labelKey: 'admin:users.role_names.api', rank: 0 },
};

/** Every user role, in the order the user form offers them. */
export const USER_ROLES = Object.keys(ROLE_META) as [UserRole, ...UserRole[]];

/**
 * Reads a `UserDto.role` into a {@link UserRole}. Platform writes the read side as a lower-case
 * string while the write side takes the enum name, so the match is case-insensitive. Returns
 * `undefined` for an empty or unknown value.
 */
export function normalizeUserRole(raw: string | null | undefined): UserRole | undefined {
  if (!raw) return undefined;
  const wanted = raw.trim().toLowerCase();
  if (!wanted) return undefined;
  return USER_ROLES.find((role) => role.toLowerCase() === wanted);
}

/** The i18n key of a role's label, valid with any `t`. */
export function userRoleLabelKey(role: UserRole): string {
  return ROLE_META[role].labelKey;
}

/** `true` when `next` ranks below `current`: Platform then ends the user's sessions. */
export function isLowerRole(next: UserRole, current: UserRole): boolean {
  return ROLE_META[next].rank < ROLE_META[current].rank;
}
