import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import {
  agencyUnits,
  caseTypes,
  dutySessions,
  referrals,
  tenants,
} from "@workspace/db";
import {
  ensureCaseForReport,
  ensureTenant,
  ensureTenantUser,
  opsDb,
  OPS_UNSUPPORTED,
} from "../lib/opsStore";
import { citizenReportStore, currentAgency } from "../lib/citizenReportStore";
import { recordAuditEvent } from "../lib/auditStore";
import {
  requireAdmin,
  requireAgencyAccess,
  requireAuth,
} from "../middlewares/authMiddleware";
import { isAdminRole } from "../lib/auth";
import { logger } from "../lib/logger";

/**
 * Operational-model endpoints over the tenant-scoped tables (agency_units,
 * case_types, duty_sessions, referrals). DB mode only — without DATABASE_URL
 * they return 503 (referrals falls through to the legacy in-memory MVP route).
 */
const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Ops request failed");
  res.status(500).json({ error: "Internal error processing the request." });
}

function requireDb(res: Response) {
  const db = opsDb();
  if (!db) res.status(503).json({ error: OPS_UNSUPPORTED });
  return db;
}

// ---- Agency units -----------------------------------------------------------

const UnitCreateSchema = z.object({
  agency: z.string().min(2).max(40),
  name: z.string().min(2).max(120),
  level: z.string().min(2).max(40),
  state: z.string().max(60).optional(),
  lga: z.string().max(60).optional(),
  parentUnitId: z.string().uuid().optional(),
});

router.get("/agency-units", async (req, res) => {
  const agency = String(req.query.agency ?? "");
  if (!agency) {
    res.status(400).json({ error: "agency query parameter is required" });
    return;
  }
  if (!requireAgencyAccess(req, res, agency)) return;
  const db = requireDb(res);
  if (!db) return;
  try {
    const tenant = await ensureTenant(agency);
    const rows = await db
      .select()
      .from(agencyUnits)
      .where(eq(agencyUnits.tenantId, tenant.id))
      .orderBy(agencyUnits.createdAt);
    res.json({ units: rows });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/agency-units", async (req, res) => {
  const parsed = UnitCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  const auth = requireAgencyAccess(req, res, parsed.data.agency);
  if (!auth) return;
  const db = requireDb(res);
  if (!db) return;
  try {
    const tenant = await ensureTenant(parsed.data.agency);
    const [row] = await db
      .insert(agencyUnits)
      .values({
        tenantId: tenant.id,
        name: parsed.data.name,
        level: parsed.data.level,
        state: parsed.data.state,
        lga: parsed.data.lga,
        parentUnitId: parsed.data.parentUnitId,
      })
      .returning();
    res.status(201).json({ unit: row });
  } catch (error) {
    fail(res, error);
  }
});

// ---- Case types --------------------------------------------------------------

const CaseTypeCreateSchema = z.object({
  agency: z.string().min(2).max(40),
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(120),
  workflow: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  slaMinutes: z.number().int().positive().optional(),
});

router.get("/case-types", async (req, res) => {
  const agency = String(req.query.agency ?? "");
  if (!agency) {
    res.status(400).json({ error: "agency query parameter is required" });
    return;
  }
  if (!requireAgencyAccess(req, res, agency)) return;
  const db = requireDb(res);
  if (!db) return;
  try {
    const tenant = await ensureTenant(agency);
    const rows = await db
      .select()
      .from(caseTypes)
      .where(eq(caseTypes.tenantId, tenant.id))
      .orderBy(caseTypes.code);
    res.json({ caseTypes: rows });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/case-types", async (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const parsed = CaseTypeCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  const db = requireDb(res);
  if (!db) return;
  try {
    const tenant = await ensureTenant(parsed.data.agency);
    const [row] = await db
      .insert(caseTypes)
      .values({
        tenantId: tenant.id,
        code: parsed.data.code.toLowerCase(),
        name: parsed.data.name,
        primaryAgencyType: "custom",
        ...(parsed.data.workflow ? { workflow: parsed.data.workflow } : {}),
        ...(parsed.data.requiredFields ? { requiredFields: parsed.data.requiredFields } : {}),
        ...(parsed.data.slaMinutes ? { slaMinutes: parsed.data.slaMinutes } : {}),
      })
      .returning();
    res.status(201).json({ caseType: row });
  } catch (error) {
    fail(res, error);
  }
});

// ---- Duty sessions ------------------------------------------------------------

const DutyStartSchema = z.object({
  location: z.record(z.string(), z.unknown()).optional(),
});

const DutyEndSchema = z.object({
  location: z.record(z.string(), z.unknown()).optional(),
  patrolLog: z.array(z.record(z.string(), z.unknown())).optional(),
});

router.get("/duty-sessions", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const db = requireDb(res);
  if (!db) return;
  try {
    const agency = String(req.query.agency ?? auth.agency);
    if (!isAdminRole(auth.role) && agency.toLowerCase() !== auth.agency.toLowerCase()) {
      res.status(403).json({ error: "You can only view your own agency's duty sessions." });
      return;
    }
    const tenant = await ensureTenant(agency);
    const rows = await db
      .select()
      .from(dutySessions)
      .where(eq(dutySessions.tenantId, tenant.id))
      .orderBy(desc(dutySessions.startedAt))
      .limit(200);
    res.json({ dutySessions: rows });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/duty-sessions/start", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const parsed = DutyStartSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  const db = requireDb(res);
  if (!db) return;
  try {
    const officer = await ensureTenantUser(auth);
    const [open] = await db
      .select({ id: dutySessions.id })
      .from(dutySessions)
      .where(and(eq(dutySessions.officerId, officer.id), eq(dutySessions.status, "on_duty")))
      .limit(1);
    if (open) {
      res.status(409).json({ error: "An open duty session already exists.", dutySessionId: open.id });
      return;
    }
    const [row] = await db
      .insert(dutySessions)
      .values({
        tenantId: officer.tenantId,
        officerId: officer.id,
        startLocation: parsed.data.location,
      })
      .returning();
    res.status(201).json({ dutySession: row });
  } catch (error) {
    fail(res, error);
  }
});

router.patch("/duty-sessions/:id/end", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const parsed = DutyEndSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  const db = requireDb(res);
  if (!db) return;
  try {
    const officer = await ensureTenantUser(auth);
    const [existing] = await db
      .select()
      .from(dutySessions)
      .where(eq(dutySessions.id, req.params.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Duty session not found." });
      return;
    }
    if (existing.officerId !== officer.id && !isAdminRole(auth.role)) {
      res.status(403).json({ error: "You can only end your own duty session." });
      return;
    }
    const [row] = await db
      .update(dutySessions)
      .set({
        status: "off_duty",
        endedAt: new Date(),
        endLocation: parsed.data.location,
        ...(parsed.data.patrolLog ? { patrolLog: parsed.data.patrolLog } : {}),
      })
      .where(eq(dutySessions.id, req.params.id))
      .returning();
    res.json({ dutySession: row });
  } catch (error) {
    fail(res, error);
  }
});

// ---- Referrals ------------------------------------------------------------------
// Registered only in DB mode so the legacy in-memory MVP /referrals routes keep
// serving local/demo development.

const ReferralCreateSchema = z.object({
  reportReference: z.string().min(3).max(60),
  toAgency: z.string().min(2).max(40),
  reason: z.string().min(2).max(500),
  dueAt: z.string().datetime({ offset: true }).optional(),
});

const ReferralStatusSchema = z.object({
  status: z.enum(["pending", "acknowledged", "actioned", "closed"]),
  note: z.string().max(500).optional(),
});

if (opsDb()) {
  router.get("/referrals", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const db = requireDb(res);
    if (!db) return;
    try {
      const agency = String(req.query.agency ?? auth.agency);
      if (!isAdminRole(auth.role) && agency.toLowerCase() !== auth.agency.toLowerCase()) {
        res.status(403).json({ error: "You can only view your own agency's referrals." });
        return;
      }
      const tenant = await ensureTenant(agency);
      const rows = await db
        .select()
        .from(referrals)
        .where(eq(referrals.toTenantId, tenant.id))
        .orderBy(desc(referrals.createdAt))
        .limit(200);
      const sent = await db
        .select()
        .from(referrals)
        .where(eq(referrals.fromTenantId, tenant.id))
        .orderBy(desc(referrals.createdAt))
        .limit(200);
      res.json({ referrals: { received: rows, sent } });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/referrals", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const parsed = ReferralCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
      return;
    }
    const db = requireDb(res);
    if (!db) return;
    try {
      const report = await citizenReportStore.findByIdOrReference(parsed.data.reportReference);
      if (!report) {
        res.status(404).json({ error: `No report found for ${parsed.data.reportReference}` });
        return;
      }
      const owning = currentAgency(report);
      if (!requireAgencyAccess(req, res, owning)) return;
      const officer = await ensureTenantUser(auth);
      const caseRow = await ensureCaseForReport(report, owning);
      const toTenant = await ensureTenant(parsed.data.toAgency);
      const [row] = await db
        .insert(referrals)
        .values({
          caseId: caseRow.id,
          fromTenantId: officer.tenantId,
          toTenantId: toTenant.id,
          reason: parsed.data.reason,
          createdById: officer.id,
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
        })
        .returning();
      recordAuditEvent({
        type: "referral",
        title: "Referral created",
        detail: `${report.reference} referred from ${auth.agency} to ${parsed.data.toAgency}`,
        actorUserId: auth.sub,
        actorAgency: auth.agency,
        targetId: row.id,
        reportReference: report.reference,
      });
      res.status(201).json({ referral: row });
    } catch (error) {
      fail(res, error);
    }
  });

  router.patch("/referrals/:id/status", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const parsed = ReferralStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
      return;
    }
    const db = requireDb(res);
    if (!db) return;
    try {
      const [existing] = await db
        .select()
        .from(referrals)
        .where(eq(referrals.id, req.params.id))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Referral not found." });
        return;
      }
      if (!isAdminRole(auth.role)) {
        const [toTenant] = await db
          .select({ shortName: tenants.shortName })
          .from(tenants)
          .where(eq(tenants.id, existing.toTenantId))
          .limit(1);
        if (!toTenant || toTenant.shortName !== auth.agency.toLowerCase()) {
          res.status(403).json({ error: "Only the receiving agency can update this referral." });
          return;
        }
      }
      const notes = parsed.data.note
        ? [...existing.notes, { note: parsed.data.note, by: auth.name, at: new Date().toISOString() }]
        : existing.notes;
      const [row] = await db
        .update(referrals)
        .set({ status: parsed.data.status, notes, updatedAt: new Date() })
        .where(eq(referrals.id, req.params.id))
        .returning();
      res.json({ referral: row });
    } catch (error) {
      fail(res, error);
    }
  });
}

export default router;
