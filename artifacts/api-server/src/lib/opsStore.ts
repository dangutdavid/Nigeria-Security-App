import { eq } from "drizzle-orm";
import {
  getDb,
  isDbConfigured,
  tenants,
  users,
  cases,
} from "@workspace/db";
import type { AuthClaims } from "./auth";
import type { CitizenReportRecord } from "./citizenReportStore";

/**
 * Bridge between the flat mobile model (plain agency ids, auth_users) and the
 * tenant-scoped operational tables (tenants, users, cases). Rows are created
 * on demand so duty sessions, referrals, case types and units are usable
 * without a separate provisioning step. DB mode only.
 */

const KNOWN_AGENCY_TYPES = new Set([
  "frsc",
  "police",
  "vio",
  "civil_defence",
  "admin",
  "citizen",
  "dss",
  "fire_service",
]);

type AgencyTypeEnum =
  | "frsc"
  | "police"
  | "vio"
  | "civil_defence"
  | "admin"
  | "citizen"
  | "dss"
  | "fire_service"
  | "custom";

function toAgencyType(agencyId: string): AgencyTypeEnum {
  const id = agencyId.toLowerCase();
  return (KNOWN_AGENCY_TYPES.has(id) ? id : "custom") as AgencyTypeEnum;
}

export function opsDb() {
  const db = getDb();
  if (!db || !isDbConfigured()) return null;
  return db;
}

export const OPS_UNSUPPORTED =
  "This endpoint requires DATABASE_URL (Postgres mode). Not available with the in-memory local-dev fallback.";

/** Find-or-create the tenants row for a plain agency id (keyed by shortName). */
export async function ensureTenant(agencyId: string): Promise<{ id: string }> {
  const db = opsDb();
  if (!db) throw new Error(OPS_UNSUPPORTED);
  const shortName = agencyId.toLowerCase();
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shortName, shortName))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(tenants)
    .values({
      agencyType: toAgencyType(shortName),
      name: shortName.toUpperCase(),
      shortName,
      primaryColor: "#344054",
    })
    .onConflictDoNothing({ target: tenants.shortName })
    .returning({ id: tenants.id });
  if (created) return created;
  const [raced] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shortName, shortName))
    .limit(1);
  if (!raced) throw new Error(`Failed to ensure tenant for agency ${agencyId}`);
  return raced;
}

/** Find-or-create the tenant-scoped users row mirroring the auth claims. */
export async function ensureTenantUser(claims: AuthClaims): Promise<{ id: string; tenantId: string }> {
  const db = opsDb();
  if (!db) throw new Error(OPS_UNSUPPORTED);
  const tenant = await ensureTenant(claims.agency);
  const badge = claims.badgeNumber.toUpperCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.badgeNumber, badge))
    .limit(1);
  if (existing) return { id: existing.id, tenantId: tenant.id };
  const [created] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      name: claims.name,
      badgeNumber: badge,
      email: `${badge.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@users.local`,
      role: claims.role,
    })
    .returning({ id: users.id });
  return { id: created.id, tenantId: tenant.id };
}

/**
 * Find-or-create a minimal `cases` mirror of a citizen report, so tables with
 * a case FK (referrals, tenant evidence) can attach to citizen reports.
 */
export async function ensureCaseForReport(
  report: CitizenReportRecord,
  owningAgency: string,
): Promise<{ id: string }> {
  const db = opsDb();
  if (!db) throw new Error(OPS_UNSUPPORTED);
  const [existing] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(eq(cases.reference, report.reference))
    .limit(1);
  if (existing) return existing;
  const tenant = await ensureTenant(owningAgency);
  const [created] = await db
    .insert(cases)
    .values({
      reference: report.reference,
      tenantId: tenant.id,
      status: report.status,
      title: report.incidentType,
      description: report.description,
      location: {
        address: report.address ?? report.location,
        latitude: report.latitude ?? undefined,
        longitude: report.longitude ?? undefined,
      },
      payload: { citizenReportId: report.id },
    })
    .onConflictDoNothing({ target: cases.reference })
    .returning({ id: cases.id });
  if (created) return created;
  const [raced] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(eq(cases.reference, report.reference))
    .limit(1);
  if (!raced) throw new Error(`Failed to ensure case for report ${report.reference}`);
  return raced;
}
