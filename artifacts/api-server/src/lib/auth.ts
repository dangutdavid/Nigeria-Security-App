import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, authUsers, type Database } from "@workspace/db";
import { hashPin, verifyPin } from "./password";
import { logger } from "./logger";

export type Role = "citizen" | "officer" | "supervisor" | "commander" | "admin" | "super_admin";

export interface AuthUser {
  id: string;
  name: string;
  badgeNumber: string;
  agency: string;
  role: Role;
  station?: string;
  sector?: string;
  email?: string;
}

export interface AuthClaims {
  sub: string;
  badgeNumber: string;
  agency: string;
  role: Role;
  name: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
}

const DEMO_PIN = "1234";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12h

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-insecure-auth-secret-change-me";
if (!process.env.AUTH_SECRET) {
  logger.warn("AUTH_SECRET is not set — using an insecure development secret. Set AUTH_SECRET in production.");
}

// ---- Stateless HMAC token (no session store; survives restart while secret is stable) ----

export function signToken(user: AuthUser): string {
  const claims: AuthClaims = {
    sub: user.id,
    badgeNumber: user.badgeNumber,
    agency: user.agency,
    role: user.role,
    name: user.name,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyToken(token: string): AuthClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  if (signature.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthClaims;
    if (typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// ---- Capabilities (coarse, useful for the client; RBAC is still enforced server-side) ----

export function capabilitiesForRole(role: Role): string[] {
  if (role === "admin" || role === "super_admin") {
    return ["report:view_all", "report:reassign", "report:update_status", "agency:dashboard", "agency:manage", "user:manage"];
  }
  if (role === "commander" || role === "supervisor") {
    return ["report:view_agency", "report:update_status", "report:assign", "agency:dashboard"];
  }
  if (role === "officer") {
    return ["report:view_agency", "report:update_status"];
  }
  return [];
}

export function isAdminRole(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

// ---- User repository abstraction -------------------------------------------
// `authenticate` (and the management helpers) delegate to the active repository:
//   - DB-backed (Drizzle/Postgres) when DATABASE_URL is configured, OR
//   - demo (in-memory) otherwise.
// Route handlers depend only on `authenticate`, never on a concrete repo.

/** Outcome of an authentication attempt — distinguishes bad creds from inactive. */
export type AuthOutcome =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: "invalid" | "inactive" };

export interface CreateUserInput {
  badgeNumber: string;
  displayName: string;
  agency: string;
  role: Role;
  pin: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  displayName?: string;
  agency?: string;
  role?: Role;
  isActive?: boolean;
}

export interface UserRepository {
  readonly kind: "db" | "demo";
  authenticate(badgeNumber: string, pin: string, agency?: string): Promise<AuthOutcome>;
  // Management helpers (PART 6) — backend-safe, ready for an admin-users phase.
  createUser(input: CreateUserInput): Promise<AuthUser>;
  updateUser(id: string, patch: UpdateUserInput): Promise<AuthUser | null>;
  setActive(id: string, isActive: boolean): Promise<AuthUser | null>;
  resetPin(id: string, newPin: string): Promise<boolean>;
  /** Idempotently seed the documented demo users (no-op in demo mode). */
  seedDefaults(): Promise<void>;
}

const DEMO_PIN_VALUE = DEMO_PIN;

function roleFromBadgeSuffix(badge: string): Role | null {
  if (/-CMD$/i.test(badge)) return "commander";
  if (/-SV$/i.test(badge)) return "supervisor";
  if (/-001$/i.test(badge)) return "officer";
  return null;
}

/**
 * Synthesize a user for the dynamic-agency demo pattern ({PREFIX}-001|SV|CMD with
 * the demo PIN). This keeps DSS / Fire Service / custom agencies — which are
 * open-ended and cannot all be pre-seeded — logging in during the demo, in both
 * repository modes. Returns null when the badge/PIN don't match the pattern.
 */
function synthesizeDynamicUser(badge: string, pin: string, agency?: string): AuthUser | null {
  const role = roleFromBadgeSuffix(badge);
  if (role && pin === DEMO_PIN_VALUE && agency) {
    return {
      id: `${agency}-${badge.toLowerCase()}`,
      name: `${agency.toUpperCase()} ${role.charAt(0).toUpperCase()}${role.slice(1)}`,
      badgeNumber: badge,
      agency,
      role,
    };
  }
  return null;
}

/** The documented demo users (PART 4). Shared by both repositories. */
interface SeedUser extends AuthUser {
  pin: string;
}

const SEED_USERS: SeedUser[] = [
  { id: "demo-admin", name: "Admin Miriam Bello", badgeNumber: "ADMIN-001", agency: "admin", role: "admin", pin: DEMO_PIN, station: "HQ", sector: "Administration" },
  { id: "demo-super", name: "Super Admin Tunde Lawal", badgeNumber: "SUPER-001", agency: "admin", role: "super_admin", pin: DEMO_PIN, station: "HQ", sector: "Administration" },
  { id: "demo-frsc", name: "Okafor Emmanuel", badgeNumber: "FO-001", agency: "frsc", role: "officer", pin: DEMO_PIN, station: "FRSC Field Unit", sector: "FRSC Operations" },
  { id: "demo-police", name: "Insp. Chukwuemeka Okonkwo", badgeNumber: "NPF-001", agency: "police", role: "officer", pin: DEMO_PIN, station: "Police Division", sector: "Police Operations" },
  { id: "demo-vio", name: "Officer Grace Okafor", badgeNumber: "VIO-001", agency: "vio", role: "officer", pin: DEMO_PIN, station: "VIO Office", sector: "VIO Operations" },
  { id: "demo-nscdc", name: "Officer Daniel Musa", badgeNumber: "NSCDC-001", agency: "civil_defence", role: "officer", pin: DEMO_PIN, station: "NSCDC Field Unit", sector: "NSCDC Operations" },
];

const MANAGEMENT_UNSUPPORTED = "User management requires DATABASE_URL (DB-backed auth). Not supported in demo mode.";

// ---- Demo (in-memory) repository -------------------------------------------

class DemoUserRepository implements UserRepository {
  readonly kind = "demo" as const;

  async authenticate(badgeNumber: string, pin: string, agency?: string): Promise<AuthOutcome> {
    const badge = badgeNumber.trim().toUpperCase();
    const explicit = SEED_USERS.find(
      (user) => user.badgeNumber === badge && (!agency || user.agency === agency),
    );
    if (explicit) {
      if (explicit.pin !== pin) return { ok: false, reason: "invalid" };
      const { pin: _pin, ...safe } = explicit;
      return { ok: true, user: safe };
    }
    const dynamic = synthesizeDynamicUser(badge, pin, agency);
    if (dynamic) return { ok: true, user: dynamic };
    return { ok: false, reason: "invalid" };
  }

  async createUser(): Promise<AuthUser> {
    throw new Error(MANAGEMENT_UNSUPPORTED);
  }
  async updateUser(): Promise<AuthUser | null> {
    throw new Error(MANAGEMENT_UNSUPPORTED);
  }
  async setActive(): Promise<AuthUser | null> {
    throw new Error(MANAGEMENT_UNSUPPORTED);
  }
  async resetPin(): Promise<boolean> {
    throw new Error(MANAGEMENT_UNSUPPORTED);
  }
  async seedDefaults(): Promise<void> {
    // Demo users are resolved in-memory; nothing to seed.
  }
}

// ---- DB-backed (Drizzle/Postgres) repository -------------------------------

type AuthUserRow = typeof authUsers.$inferSelect;

function rowToAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    name: row.displayName,
    badgeNumber: row.badgeNumber,
    agency: row.agency,
    role: row.role as Role,
  };
}

class DbUserRepository implements UserRepository {
  readonly kind = "db" as const;
  constructor(private readonly db: Database) {}

  async authenticate(badgeNumber: string, pin: string, agency?: string): Promise<AuthOutcome> {
    const badge = badgeNumber.trim().toUpperCase();
    const [row] = await this.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.badgeNumber, badge))
      .limit(1);

    if (row) {
      if (agency && row.agency !== agency) return { ok: false, reason: "invalid" };
      if (!verifyPin(pin, row.pinHash)) return { ok: false, reason: "invalid" };
      if (!row.isActive) return { ok: false, reason: "inactive" };
      // Best-effort last-login stamp (non-fatal).
      this.db
        .update(authUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(authUsers.id, row.id))
        .catch((err) => logger.warn({ err }, "Failed to update lastLoginAt"));
      return { ok: true, user: rowToAuthUser(row) };
    }

    // No DB row — preserve the dynamic-agency demo pattern (custom agencies).
    const dynamic = synthesizeDynamicUser(badge, pin, agency);
    if (dynamic) return { ok: true, user: dynamic };
    return { ok: false, reason: "invalid" };
  }

  async createUser(input: CreateUserInput): Promise<AuthUser> {
    const [row] = await this.db
      .insert(authUsers)
      .values({
        badgeNumber: input.badgeNumber.trim().toUpperCase(),
        displayName: input.displayName,
        agency: input.agency,
        role: input.role,
        pinHash: hashPin(input.pin),
        isActive: input.isActive ?? true,
      })
      .returning();
    return rowToAuthUser(row);
  }

  async updateUser(id: string, patch: UpdateUserInput): Promise<AuthUser | null> {
    const [row] = await this.db
      .update(authUsers)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.agency !== undefined ? { agency: patch.agency } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, id))
      .returning();
    return row ? rowToAuthUser(row) : null;
  }

  async setActive(id: string, isActive: boolean): Promise<AuthUser | null> {
    return this.updateUser(id, { isActive });
  }

  async resetPin(id: string, newPin: string): Promise<boolean> {
    const [row] = await this.db
      .update(authUsers)
      .set({ pinHash: hashPin(newPin), updatedAt: new Date() })
      .where(eq(authUsers.id, id))
      .returning();
    return Boolean(row);
  }

  async seedDefaults(): Promise<void> {
    let created = 0;
    for (const user of SEED_USERS) {
      const inserted = await this.db
        .insert(authUsers)
        .values({
          badgeNumber: user.badgeNumber,
          displayName: user.name,
          agency: user.agency,
          role: user.role,
          pinHash: hashPin(user.pin),
        })
        .onConflictDoNothing({ target: authUsers.badgeNumber })
        .returning();
      if (inserted.length > 0) created += 1;
    }
    logger.info(
      { created, total: SEED_USERS.length },
      created > 0 ? "Seeded default auth users" : "Default auth users already present",
    );
  }
}

// ---- Repository selection + public API -------------------------------------

function createUserRepository(): UserRepository {
  const db = getDb();
  if (db && isDbConfigured()) {
    logger.info("Auth repository: PostgreSQL (Drizzle)");
    return new DbUserRepository(db);
  }
  logger.warn("Auth repository: demo in-memory fallback (set DATABASE_URL for DB-backed auth)");
  return new DemoUserRepository();
}

export const userRepository: UserRepository = createUserRepository();

/**
 * Initialize auth at startup: in DB mode, idempotently seed the demo users.
 * Safe to call always; never throws on a missing/unreachable DB.
 */
export async function initAuth(): Promise<void> {
  try {
    await userRepository.seedDefaults();
  } catch (err) {
    logger.error({ err }, "Auth seeding failed — login may be limited until the database is reachable");
  }
}

/**
 * Authenticate a badge + PIN (+ optional agency) against the active repository.
 * Returns an outcome distinguishing invalid credentials from an inactive account.
 */
export function authenticate(badgeNumber: string, pin: string, agency?: string): Promise<AuthOutcome> {
  return userRepository.authenticate(badgeNumber, pin, agency);
}
