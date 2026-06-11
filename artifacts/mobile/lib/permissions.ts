import { useAuth, type AgencyType, type User, type UserRole } from "@/context/AuthContext";

/**
 * Centralized Role-Based Access Control (RBAC) for the multi-agency app.
 *
 * Design notes (kept backend-shaped for a future Postgres/api-server migration):
 *  - The capability matrix is keyed by ROLE only. The three roles
 *    (field_officer | supervisor | commander) are agency-neutral; agencies differ
 *    only in the DISPLAY label shown for each role (see ROLE_LABELS).
 *  - Agency separation is a DATA rule, not a permission rule. Use scopeToAgency()
 *    to keep a user limited to their own agency's records (e.g. user management).
 *  - When this migrates to a server, `can()` becomes the client mirror of a
 *    server-enforced policy, and scopeToAgency() becomes a row-level tenancy
 *    filter keyed by the authenticated user's agency.
 */

export type Action =
  | "view_own" // records the user created / owns
  | "view_agency" // all records within the user's own agency
  | "view_shared" // records shared cross-agency (referrals, shared registry)
  | "create"
  | "edit"
  | "assign" // assign a case/record to another officer
  | "delete"
  | "manage_users"
  | "reset_pin"
  | "refer"; // refer/share a record to another agency

export type Resource =
  | "incident" // FRSC crashes/incidents
  | "crime_report" // NPF crime reports
  | "inspection" // VIO inspections
  | "theft_report" // shared stolen-vehicle registry
  | "patrol" // duty/patrol sessions
  | "user" // officer accounts
  | "analytics"
  | "referral"; // cross-agency referrals

type Capabilities = Partial<Record<Resource, Action[]>>;

const FIELD_OFFICER: Capabilities = {
  incident: ["view_own", "view_agency", "create", "edit"],
  crime_report: ["view_own", "view_agency", "create", "edit"],
  inspection: ["view_own", "view_agency", "create", "edit"],
  theft_report: ["view_own", "view_agency", "view_shared", "create"],
  patrol: ["view_own", "create", "edit"],
  analytics: ["view_agency"],
  referral: ["view_shared"],
  user: [],
};

const SUPERVISOR: Capabilities = {
  incident: ["view_own", "view_agency", "create", "edit", "assign", "refer"],
  crime_report: ["view_own", "view_agency", "create", "edit", "assign", "refer"],
  inspection: ["view_own", "view_agency", "create", "edit", "assign", "refer"],
  theft_report: ["view_own", "view_agency", "view_shared", "create", "refer"],
  patrol: ["view_own", "view_agency", "create", "edit"],
  analytics: ["view_agency"],
  referral: ["view_shared", "create", "edit"],
  user: ["view_agency", "manage_users", "create", "edit", "reset_pin"],
};

const COMMANDER: Capabilities = {
  incident: ["view_own", "view_agency", "create", "edit", "assign", "refer", "delete"],
  crime_report: ["view_own", "view_agency", "create", "edit", "assign", "refer", "delete"],
  inspection: ["view_own", "view_agency", "create", "edit", "assign", "refer", "delete"],
  theft_report: ["view_own", "view_agency", "view_shared", "create", "refer", "delete"],
  patrol: ["view_own", "view_agency"],
  analytics: ["view_agency"],
  referral: ["view_shared", "create", "edit", "delete"],
  user: ["view_agency", "manage_users", "create", "edit", "reset_pin", "delete"],
};

const MATRIX: Record<UserRole, Capabilities> = {
  field_officer: FIELD_OFFICER,
  supervisor: SUPERVISOR,
  commander: COMMANDER,
};

/** Core permission check. Returns false when there is no authenticated user. */
export function can(user: User | null | undefined, action: Action, resource: Resource): boolean {
  if (!user) return false;
  return MATRIX[user.role]?.[resource]?.includes(action) ?? false;
}

/**
 * Agency display labels per role. The underlying role enum is shared across
 * agencies; only the wording changes (e.g. a "supervisor" is a "Deputy
 * Superintendent" in the police agency).
 */
export const ROLE_LABELS: Record<AgencyType, Record<UserRole, string>> = {
  frsc: {
    field_officer: "Field Officer",
    supervisor: "Supervisor",
    commander: "Operations Commander",
  },
  police: {
    field_officer: "Inspector",
    supervisor: "Deputy Superintendent",
    commander: "Assistant Commissioner",
  },
  vio: {
    field_officer: "Inspection Officer",
    supervisor: "Senior Inspector",
    commander: "Director / Chief Inspector",
  },
};

export function roleLabel(agency: AgencyType | undefined, role: UserRole): string {
  if (!agency) return role;
  return ROLE_LABELS[agency]?.[role] ?? role;
}

/**
 * Roles a user is allowed to assign when creating/editing officers.
 *  - commander: any role
 *  - supervisor: field officers only
 *  - field officer: none (cannot manage users)
 */
export function assignableRoles(user: User | null | undefined): UserRole[] {
  if (!user) return [];
  if (user.role === "commander") return ["field_officer", "supervisor", "commander"];
  if (user.role === "supervisor") return ["field_officer"];
  return [];
}

/** Limit a list of agency-scoped records to the user's own agency (data tenancy). */
export function scopeToAgency<T extends { agency?: AgencyType }>(
  user: User | null | undefined,
  items: T[]
): T[] {
  if (!user) return [];
  return items.filter((it) => it.agency === user.agency);
}

/** The other agencies a user can refer/share records to. */
export function referableAgencies(user: User | null | undefined): AgencyType[] {
  const all: AgencyType[] = ["frsc", "police", "vio"];
  if (!user) return all;
  return all.filter((a) => a !== user.agency);
}

/** React hook exposing permission helpers bound to the current user. */
export function usePermissions() {
  const { user } = useAuth();
  return {
    user,
    can: (action: Action, resource: Resource) => can(user, action, resource),
    roleLabel: user ? roleLabel(user.agency, user.role) : "",
    assignableRoles: assignableRoles(user),
    referableAgencies: referableAgencies(user),
    scopeToAgency: <T extends { agency?: AgencyType }>(items: T[]) => scopeToAgency(user, items),
  };
}
