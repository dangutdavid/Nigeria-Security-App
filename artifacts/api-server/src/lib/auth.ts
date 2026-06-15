import { createHmac, timingSafeEqual } from "node:crypto";
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

// ---- User repository abstraction ----
// Demo (in-memory) implementation: covers the documented demo credentials plus a
// generic rule for dynamic agencies ({PREFIX}-001/SV/CMD with the demo PIN). A
// DB-backed implementation can replace this once users are seeded in the flat
// agency/role/pin model (see docs); route handlers depend only on `authenticate`.

interface DemoUser extends AuthUser {
  pin: string;
}

const DEMO_USERS: DemoUser[] = [
  { id: "demo-admin", name: "Admin Miriam Bello", badgeNumber: "ADMIN-001", agency: "admin", role: "admin", pin: DEMO_PIN, station: "HQ", sector: "Administration" },
  { id: "demo-super", name: "Super Admin Tunde Lawal", badgeNumber: "SUPER-001", agency: "admin", role: "super_admin", pin: DEMO_PIN, station: "HQ", sector: "Administration" },
  { id: "demo-frsc", name: "Okafor Emmanuel", badgeNumber: "FO-001", agency: "frsc", role: "officer", pin: DEMO_PIN, station: "FRSC Field Unit", sector: "FRSC Operations" },
  { id: "demo-police", name: "Insp. Chukwuemeka Okonkwo", badgeNumber: "NPF-001", agency: "police", role: "officer", pin: DEMO_PIN, station: "Police Division", sector: "Police Operations" },
  { id: "demo-vio", name: "Officer Grace Okafor", badgeNumber: "VIO-001", agency: "vio", role: "officer", pin: DEMO_PIN, station: "VIO Office", sector: "VIO Operations" },
  { id: "demo-nscdc", name: "Officer Daniel Musa", badgeNumber: "NSCDC-001", agency: "civil_defence", role: "officer", pin: DEMO_PIN, station: "NSCDC Field Unit", sector: "NSCDC Operations" },
];

function roleFromBadgeSuffix(badge: string): Role | null {
  if (/-CMD$/i.test(badge)) return "commander";
  if (/-SV$/i.test(badge)) return "supervisor";
  if (/-001$/i.test(badge)) return "officer";
  return null;
}

function toAuthUser(user: DemoUser): AuthUser {
  const { pin: _pin, ...safe } = user;
  return safe;
}

/**
 * Resolve a demo login. Returns the safe user (no PIN) or null on bad credentials.
 * Falls back to a generic dynamic-agency rule so newly added agencies
 * (DSS / Fire Service / custom) work with {PREFIX}-001|SV|CMD and the demo PIN.
 */
export function authenticate(badgeNumber: string, pin: string, agency?: string): AuthUser | null {
  const badge = badgeNumber.trim().toUpperCase();
  const explicit = DEMO_USERS.find(
    (user) => user.badgeNumber === badge && (!agency || user.agency === agency),
  );
  if (explicit) {
    return explicit.pin === pin ? toAuthUser(explicit) : null;
  }
  const role = roleFromBadgeSuffix(badge);
  if (role && pin === DEMO_PIN && agency) {
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
