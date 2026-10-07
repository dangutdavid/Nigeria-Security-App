import type { Role } from "./auth";

/**
 * Single source of truth for role-based permissions. The same matrix drives
 * BOTH what the server enforces (requireCapability) and what the app is told
 * at login (capabilitiesForRole) — so the UI can never advertise an action the
 * server would refuse, or vice versa. Agency scoping (own agency vs all) is
 * applied on top by requireCapability and, independently, by Postgres RLS.
 *
 * Changing a row here is a security decision: update docs/security/PERMISSIONS.md
 * and the contract test (tests/permissions.test.ts) with it.
 */
export const CAPABILITY_MATRIX = {
  "report:view_all": ["admin", "super_admin"],
  "report:view_agency": ["officer", "supervisor", "commander", "admin", "super_admin"],
  "report:update_status": ["officer", "supervisor", "commander", "admin", "super_admin"],
  "report:assign": ["supervisor", "commander", "admin", "super_admin"],
  "report:reassign": ["admin", "super_admin"],
  "agency:dashboard": ["officer", "supervisor", "commander", "admin", "super_admin"],
  "agency:manage": ["admin", "super_admin"],
  "user:manage": ["admin", "super_admin"],
  "audit:read": ["admin", "super_admin"],
  "privacy:erase": ["admin", "super_admin"],
  "mfa:reset": ["admin", "super_admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITY_MATRIX;

export function hasCapability(role: Role | string, capability: Capability): boolean {
  return (CAPABILITY_MATRIX[capability] as readonly string[]).includes(role);
}

export function capabilitiesFor(role: Role | string): Capability[] {
  return (Object.keys(CAPABILITY_MATRIX) as Capability[]).filter((c) => hasCapability(role, c));
}
