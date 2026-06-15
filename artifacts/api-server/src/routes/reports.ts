import { Router, type IRouter } from "express";
import {
  ReportReassignSchema,
  ReportStatusUpdateSchema,
  ReportTimelineAppendSchema,
} from "@workspace/api-zod";
import {
  agencyDashboardMetrics,
  citizenReportStore,
  toReportPayload,
} from "../lib/citizenReportStore";

const router: IRouter = Router();

// PART 1 — All reports (admin) and per-agency report lists.
router.get("/reports", (_req, res) => {
  res.json({ reports: citizenReportStore.list().map(toReportPayload) });
});

router.get("/agencies/:agency/reports", (req, res) => {
  const reports = citizenReportStore.listByAgency(req.params.agency);
  res.json({ reports: reports.map(toReportPayload) });
});

// PART 2 — Agency dashboard metrics.
router.get("/agencies/:agency/dashboard", (req, res) => {
  const reports = citizenReportStore.listByAgency(req.params.agency);
  res.json({ agency: req.params.agency, metrics: agencyDashboardMetrics(reports) });
});

// PART 3 — Report detail (agency view).
router.get("/reports/:id", (req, res) => {
  const report = citizenReportStore.findByIdOrReference(req.params.id);
  if (!report) {
    res.status(404).json({ error: `No report found for ${req.params.id}` });
    return;
  }
  res.json({ report: toReportPayload(report) });
});

// PART 4 — Status update.
router.patch("/reports/:id/status", (req, res) => {
  const result = ReportStatusUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  const report = citizenReportStore.updateStatus(
    req.params.id,
    result.data.status,
    result.data.note,
    result.data.actorName,
  );
  if (!report) {
    res.status(404).json({ error: `No report found for ${req.params.id}` });
    return;
  }
  res.json({ report: toReportPayload(report) });
});

// PART 5 — Admin reassignment.
router.post("/reports/:id/reassign", (req, res) => {
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
  const report = citizenReportStore.reassign(req.params.id, targetAgency, result.data.actorName);
  if (!report) {
    res.status(404).json({ error: `No report found for ${req.params.id}` });
    return;
  }
  res.json({ report: toReportPayload(report) });
});

// PART 6 — Append a timeline entry.
router.post("/reports/:id/timeline", (req, res) => {
  const result = ReportTimelineAppendSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  const report = citizenReportStore.appendTimeline(
    req.params.id,
    result.data.action,
    result.data.actorName,
  );
  if (!report) {
    res.status(404).json({ error: `No report found for ${req.params.id}` });
    return;
  }
  res.json({ report: toReportPayload(report) });
});

export default router;
