import { Router, type IRouter, type Response } from "express";
import {
  ReportReassignSchema,
  ReportStatusUpdateSchema,
  ReportTimelineAppendSchema,
} from "@workspace/api-zod";
import {
  agencyDashboardMetrics,
  citizenReportStore,
  currentAgency,
  toReportPayload,
} from "../lib/citizenReportStore";
import { notifyReassigned, notifyStatusChanged } from "../lib/notificationStore";
import { recordAuditEvent } from "../lib/auditStore";
import { logger } from "../lib/logger";
import { isAdminRole } from "../lib/auth";
import {
  requireAdmin,
  requireAgencyAccess,
  requireAuth,
} from "../middlewares/authMiddleware";

const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Agency report request failed");
  res.status(500).json({ error: "Internal error processing the report request." });
}

// PART 1 — All reports: admin / super_admin only.
router.get("/reports", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const reports = await citizenReportStore.list();
    res.json({ reports: reports.map(toReportPayload) });
  } catch (error) {
    fail(res, error);
  }
});

// Per-agency report list: admins, or users of that agency only.
router.get("/agencies/:agency/reports", async (req, res) => {
  if (!requireAgencyAccess(req, res, req.params.agency)) return;
  try {
    const reports = await citizenReportStore.listByAgency(req.params.agency);
    res.json({ reports: reports.map(toReportPayload) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 2 — Agency dashboard metrics: admins, or users of that agency only.
router.get("/agencies/:agency/dashboard", async (req, res) => {
  if (!requireAgencyAccess(req, res, req.params.agency)) return;
  try {
    const reports = await citizenReportStore.listByAgency(req.params.agency);
    res.json({ agency: req.params.agency, metrics: agencyDashboardMetrics(reports) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 3 — Report detail: admins, or users of the report's current agency.
router.get("/reports/:id", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const report = await citizenReportStore.findByIdOrReference(req.params.id);
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    if (!isAdminRole(auth.role) && auth.agency.toLowerCase() !== currentAgency(report).toLowerCase()) {
      res.status(403).json({ error: "You can only view your own agency's reports." });
      return;
    }
    res.json({ report: toReportPayload(report) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 4 — Status update: admins, or agency users of the report's current agency.
router.patch("/reports/:id/status", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const result = ReportStatusUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    const existing = await citizenReportStore.findByIdOrReference(req.params.id);
    if (!existing) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    if (!isAdminRole(auth.role) && auth.agency.toLowerCase() !== currentAgency(existing).toLowerCase()) {
      res.status(403).json({ error: "You can only update your own agency's reports." });
      return;
    }
    const report = await citizenReportStore.updateStatus(
      req.params.id,
      result.data.status,
      result.data.note,
      result.data.actorName,
    );
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    await notifyStatusChanged(report, result.data.actorName);
    recordAuditEvent({
      type: "report",
      title: "Report status updated",
      detail: `${report.reference} moved to ${result.data.status}`,
      actorUserId: auth.sub,
      actorAgency: auth.agency,
      reportReference: report.reference,
    });
    res.json({ report: toReportPayload(report) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 5 — Reassignment: admin / super_admin only.
router.post("/reports/:id/reassign", async (req, res) => {
  const adminAuth = requireAdmin(req, res);
  if (!adminAuth) return;
  const result = ReportReassignSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  const targetAgency = result.data.agency ?? result.data.targetAgency;
  if (!targetAgency) {
    res.status(400).json({ error: "A target agency is required." });
    return;
  }
  try {
    const existing = await citizenReportStore.findByIdOrReference(req.params.id);
    const fromAgency = existing ? currentAgency(existing) : targetAgency;
    const report = await citizenReportStore.reassign(req.params.id, targetAgency, result.data.actorName);
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    await notifyReassigned(report, fromAgency, result.data.actorName);
    recordAuditEvent({
      type: "report",
      title: "Report reassigned",
      detail: `${report.reference} reassigned from ${fromAgency} to ${targetAgency}`,
      severity: "warning",
      actorUserId: adminAuth.sub,
      actorAgency: adminAuth.agency,
      reportReference: report.reference,
    });
    res.json({ report: toReportPayload(report) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 6 — Append a timeline entry: admins, or agency users of the report's agency.
router.post("/reports/:id/timeline", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const result = ReportTimelineAppendSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    const existing = await citizenReportStore.findByIdOrReference(req.params.id);
    if (!existing) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    if (!isAdminRole(auth.role) && auth.agency.toLowerCase() !== currentAgency(existing).toLowerCase()) {
      res.status(403).json({ error: "You can only update your own agency's reports." });
      return;
    }
    const report = await citizenReportStore.appendTimeline(
      req.params.id,
      result.data.action,
      result.data.actorName,
    );
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    res.json({ report: toReportPayload(report) });
  } catch (error) {
    fail(res, error);
  }
});

export default router;
