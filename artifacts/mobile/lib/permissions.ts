import { useAuth, type AgencyType, type User, type UserRole } from "@/context/AuthContext";

/**
 * Centralized Role-Based Access Control (RBAC) for the multi-agency app.
 *
 * Design notes (kept backend-shaped for a future Postgres/api-server migration):
 *  - The capability matrix is keyed by ROLE. Operational agency roles
 *    (officer | supervisor | commander) are agency-neutral; agencies differ
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
  | "view_all"
  | "refer"; // refer/share a record to another agency

export type Resource =
  | "incident" // FRSC crashes/incidents
  | "crime_report" // NPF crime reports
  | "inspection" // VIO inspections
  | "theft_report" // shared stolen-vehicle registry
  | "patrol" // duty/patrol sessions
  | "user" // officer accounts
  | "analytics"
  | "referral" // cross-agency referrals
  | "system"; // platform administration

type Capabilities = Partial<Record<Resource, Action[]>>;

const CITIZEN: Capabilities = {
  incident: ["create", "view_own"],
  theft_report: ["create", "view_own", "view_shared"],
};

const OFFICER: Capabilities = {
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

const ADMIN: Capabilities = {
  incident: ["view_all", "view_agency", "view_shared", "assign", "refer", "edit"],
  crime_report: ["view_all", "view_agency", "view_shared", "assign", "refer", "edit"],
  inspection: ["view_all", "view_agency", "view_shared", "assign", "refer", "edit"],
  theft_report: ["view_all", "view_shared", "edit"],
  patrol: ["view_all", "view_agency"],
  analytics: ["view_all", "view_agency"],
  referral: ["view_all", "view_shared", "create", "edit"],
  user: ["view_all", "view_agency", "manage_users", "create", "edit", "reset_pin"],
  system: ["view_all", "edit"],
};

const SUPER_ADMIN: Capabilities = {
  incident: ["view_all", "view_agency", "view_shared", "assign", "refer", "edit", "delete"],
  crime_report: ["view_all", "view_agency", "view_shared", "assign", "refer", "edit", "delete"],
  inspection: ["view_all", "view_agency", "view_shared", "assign", "refer", "edit", "delete"],
  theft_report: ["view_all", "view_agency", "view_shared", "create", "refer", "edit", "delete"],
  patrol: ["view_all", "view_agency"],
  analytics: ["view_all", "view_agency"],
  referral: ["view_all", "view_shared", "create", "edit", "delete"],
  user: ["view_all", "view_agency", "manage_users", "create", "edit", "reset_pin", "delete"],
  system: ["view_all", "edit", "delete"],
};

const MATRIX: Record<UserRole, Capabilities> = {
  citizen: CITIZEN,
  officer: OFFICER,
  supervisor: SUPERVISOR,
  commander: COMMANDER,
  admin: ADMIN,
  super_admin: SUPER_ADMIN,
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
const DEFAULT_ROLE_LABELS: Record<UserRole, string> = {
  citizen: "Citizen",
  officer: "Officer",
  supervisor: "Supervisor",
  commander: "Commander",
  admin: "Administrator",
  super_admin: "Super Administrator",
};

export const ROLE_LABELS: Partial<Record<AgencyType, Record<UserRole, string>>> = {
  frsc: {
    citizen: "Citizen",
    officer: "Field Officer",
    supervisor: "Supervisor",
    commander: "Operations Commander",
    admin: "Administrator",
    super_admin: "Super Administrator",
  },
  police: {
    citizen: "Citizen",
    officer: "Inspector",
    supervisor: "Deputy Superintendent",
    commander: "Assistant Commissioner",
    admin: "Police Administrator",
    super_admin: "Police Super Administrator",
  },
  vio: {
    citizen: "Citizen",
    officer: "Inspection Officer",
    supervisor: "Senior Inspector",
    commander: "Director / Chief Inspector",
    admin: "VIO Administrator",
    super_admin: "VIO Super Administrator",
  },
  civil_defence: {
    citizen: "Citizen",
    officer: "Civil Defence Officer",
    supervisor: "Area Supervisor",
    commander: "Commandant",
    admin: "Civil Defence Administrator",
    super_admin: "Civil Defence Super Administrator",
  },
  admin: {
    citizen: "Citizen",
    officer: "Platform Officer",
    supervisor: "Platform Supervisor",
    commander: "Platform Commander",
    admin: "Administrator",
    super_admin: "Super Administrator",
  },
  citizen: {
    citizen: "Citizen",
    officer: "Officer",
    supervisor: "Supervisor",
    commander: "Commander",
    admin: "Administrator",
    super_admin: "Super Administrator",
  },
  public: {
    citizen: "Public User",
    officer: "Officer",
    supervisor: "Supervisor",
    commander: "Commander",
    admin: "Administrator",
    super_admin: "Super Administrator",
  },
};

export function roleLabel(agency: AgencyType | undefined, role: UserRole): string {
  if (!agency) return DEFAULT_ROLE_LABELS[role];
  return ROLE_LABELS[agency]?.[role] ?? DEFAULT_ROLE_LABELS[role];
}

/**
 * Roles a user is allowed to assign when creating/editing officers.
 *  - commander: any role
 *  - supervisor: officers only
 *  - officer: none (cannot manage users)
 */
export function assignableRoles(user: User | null | undefined): UserRole[] {
  if (!user) return [];
  if (user.role === "super_admin") return ["officer", "supervisor", "commander", "admin", "super_admin"];
  if (user.role === "admin") return ["officer", "supervisor", "commander", "admin"];
  if (user.role === "commander") return ["officer", "supervisor", "commander"];
  if (user.role === "supervisor") return ["officer"];
  return [];
}

export function isOfficerRole(role: UserRole | undefined): boolean {
  return role === "officer";
}

export function isSupervisorRole(role: UserRole | undefined): boolean {
  return role === "supervisor" || role === "commander" || role === "admin" || role === "super_admin";
}

export function isAdminRole(role: UserRole | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** Admins/super-admins may fully edit any agency in the registry (all fields). */
export function canManageAgencies(role: UserRole | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Agency "super users" (commander + super_admin) may self-customise their own
 * agency's branding — theme colours and logo/icon — without full registry edit
 * rights. Platform admins can customise any agency.
 */
export function canCustomizeOwnAgency(role: UserRole | undefined): boolean {
  return role === "super_admin" || role === "commander" || role === "admin";
}

/** Limit a list of agency-scoped records to the user's own agency (data tenancy). */
export function scopeToAgency<T extends { agency?: AgencyType }>(
  user: User | null | undefined,
  items: T[]
): T[] {
  if (!user) return [];
  if (can(user, "view_all", "user")) return items;
  return items.filter((it) => it.agency === user.agency);
}

/** The other agencies a user can refer/share records to. */
export function referableAgencies(user: User | null | undefined): AgencyType[] {
  const all: AgencyType[] = ["frsc", "police", "vio", "civil_defence"];
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
    isOfficer: isOfficerRole(user?.role),
    isSupervisor: isSupervisorRole(user?.role),
    isAdmin: isAdminRole(user?.role),
    canManageAgencies: canManageAgencies(user?.role),
    canCustomizeOwnAgency: canCustomizeOwnAgency(user?.role),
    scopeToAgency: <T extends { agency?: AgencyType }>(items: T[]) => scopeToAgency(user, items),
  };
}
