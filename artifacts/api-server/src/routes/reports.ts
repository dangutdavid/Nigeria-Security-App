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
import { logger } from "../lib/logger";

const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Agency report request failed");
  res.status(500).json({ error: "Internal error processing the report request." });
}

// PART 1 — All reports (admin) and per-agency report lists.
router.get("/reports", async (_req, res) => {
  try {
    const reports = await citizenReportStore.list();
    res.json({ reports: reports.map(toReportPayload) });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/agencies/:agency/reports", async (req, res) => {
  try {
    const reports = await citizenReportStore.listByAgency(req.params.agency);
    res.json({ reports: reports.map(toReportPayload) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 2 — Agency dashboard metrics.
router.get("/agencies/:agency/dashboard", async (req, res) => {
  try {
    const reports = await citizenReportStore.listByAgency(req.params.agency);
    res.json({ agency: req.params.agency, metrics: agencyDashboardMetrics(reports) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 3 — Report detail (agency view).
router.get("/reports/:id", async (req, res) => {
  try {
    const report = await citizenReportStore.findByIdOrReference(req.params.id);
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    res.json({ report: toReportPayload(report) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 4 — Status update.
router.patch("/reports/:id/status", async (req, res) => {
  const result = ReportStatusUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
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
    res.json({ report: toReportPayload(report) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 5 — Admin reassignment.
router.post("/reports/:id/reassign", async (req, res) => {
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
    res.json({ report: toReportPayload(report) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 6 — Append a timeline entry.
router.post("/reports/:id/timeline", async (req, res) => {
  const result = ReportTimelineAppendSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
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
